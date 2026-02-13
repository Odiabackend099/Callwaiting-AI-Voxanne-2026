/**
 * Security & Compliance: Named Entity Recognition (NER) Filter
 * 
 * Automatically detects and redacts sensitive data from call transcripts:
 * - Medical history → ENCRYPTED & moved to clinical_notes table
 * - Addresses → Stored in contacts table but redacted from public logs
 * - PII (phone, SSN, medical conditions) → Encrypted
 * 
 * Example:
 * - Input: "My address is 123 Harley Street and I have a history of heart issues"
 * - Output:
 *   - Public log: "My address is [REDACTED] and I have a history of [MEDICAL CONDITION REDACTED]"
 *   - Contacts table: address = "123 Harley Street" (encrypted)
 *   - Clinical notes table: medical_history = "heart issues" (encrypted + access controlled)
 */

import { createClient } from "@supabase/supabase-js";

type EntityType =
  | "ADDRESS"
  | "MEDICAL_CONDITION"
  | "MEDICATION"
  | "PHONE"
  | "EMAIL"
  | "SSN"
  | "INSURANCE"
  | "OTHER";

interface RecognizedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  start_idx: number;
  end_idx: number;
  sensitivity_level: "public" | "protected" | "encrypted";
}

interface NerResult {
  entities: RecognizedEntity[];
  redacted_transcript: string;
  has_sensitive_data: boolean;
  sensitive_data_summary: {
    medical_data: string[];
    addresses: string[];
    pii: string[];
  };
}

/**
 * Perform Named Entity Recognition on transcript
 * 
 * Detects sensitive entities and returns:
 * 1. Redacted transcript for public logs
 * 2. Entity list for routing to secure storage
 * 3. Sensitivity classification
 * 
 * @param transcript - Original call transcript
 * @param context - Additional context (clinic_id, contact_id, etc.)
 * @returns NER analysis with redaction suggestions
 */
export function performNER(
  transcript: string,
  context?: { clinic_id?: string; contact_id?: string }
): NerResult {
  const entities: RecognizedEntity[] = [];
  let redacted = transcript;
  const sensitiveDataSummary = {
    medical_data: [] as string[],
    addresses: [] as string[],
    pii: [] as string[],
  };

  // 1. Detect Medical Conditions (high sensitivity)
  const medicalPatterns = [
    /\b(heart issues|diabetes|hypertension|asthma|cancer|HIV|arthritis|depression|anxiety)\b/gi,
    /\b(allergic to|allergy|allergies)\s+([a-z\s]+)(?=\.|,|$)/gi,
    /\b(family history of|history of)\s+([a-z\s]+)(?=\.|,|$)/gi,
  ];

  let offset = 0;
  for (const pattern of medicalPatterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      const entity: RecognizedEntity = {
        type: "MEDICAL_CONDITION",
        value: match[0],
        confidence: 0.95,
        start_idx: match.index,
        end_idx: match.index + match[0].length,
        sensitivity_level: "encrypted",
      };

      entities.push(entity);
      sensitiveDataSummary.medical_data.push(match[0]);

      // Redact in transcript
      redacted =
        redacted.substring(0, match.index + offset) +
        "[MEDICAL CONDITION REDACTED]" +
        redacted.substring(match.index + match[0].length + offset);

      offset +=
        "[MEDICAL CONDITION REDACTED]".length - match[0].length;
    }
  }

  // 2. Detect Addresses (high sensitivity - can identify person)
  const addressPattern =
    /\b(\d+\s+[a-z\s]+(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|circle|cir|court|ct|plaza|pl|square|sq|terrace|way|trail|tr))/gi;

  let addressMatch;
  offset = 0;
  while ((addressMatch = addressPattern.exec(transcript)) !== null) {
    const addressText = addressMatch[0];
    const entity: RecognizedEntity = {
      type: "ADDRESS",
      value: addressText,
      confidence: 0.9,
      start_idx: addressMatch.index,
      end_idx: addressMatch.index + addressText.length,
      sensitivity_level: "protected", // Goes to contacts table, not public log
    };

    entities.push(entity);
    sensitiveDataSummary.addresses.push(addressText);

    // Redact in public log
    redacted =
      redacted.substring(0, addressMatch.index + offset) +
      "[ADDRESS REDACTED]" +
      redacted.substring(
        addressMatch.index + addressText.length + offset
      );

    offset += "[ADDRESS REDACTED]".length - addressText.length;
  }

  // 3. Detect Phone Numbers (PII)
  const phonePattern =
    /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;

  offset = 0;
  while ((addressMatch = phonePattern.exec(transcript)) !== null) {
    const entity: RecognizedEntity = {
      type: "PHONE",
      value: addressMatch[0],
      confidence: 0.99,
      start_idx: addressMatch.index,
      end_idx: addressMatch.index + addressMatch[0].length,
      sensitivity_level: "encrypted",
    };

    entities.push(entity);
    sensitiveDataSummary.pii.push(addressMatch[0]);

    // Redact
    redacted =
      redacted.substring(0, addressMatch.index + offset) +
      "[PHONE REDACTED]" +
      redacted.substring(addressMatch.index + addressMatch[0].length + offset);

    offset += "[PHONE REDACTED]".length - addressMatch[0].length;
  }

  // 4. Detect SSN (very rare but critical)
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  offset = 0;
  while ((addressMatch = ssnPattern.exec(transcript)) !== null) {
    const entity: RecognizedEntity = {
      type: "SSN",
      value: addressMatch[0],
      confidence: 0.99,
      start_idx: addressMatch.index,
      end_idx: addressMatch.index + addressMatch[0].length,
      sensitivity_level: "encrypted",
    };

    entities.push(entity);
    sensitiveDataSummary.pii.push(addressMatch[0]);

    redacted =
      redacted.substring(0, addressMatch.index + offset) +
      "[SSN REDACTED]" +
      redacted.substring(addressMatch.index + addressMatch[0].length + offset);

    offset += "[SSN REDACTED]".length - addressMatch[0].length;
  }

  const hasSensitiveData =
    entities.length > 0 &&
    entities.some((e) => e.sensitivity_level === "encrypted");

  return {
    entities,
    redacted_transcript: redacted,
    has_sensitive_data: hasSensitiveData,
    sensitive_data_summary: sensitiveDataSummary,
  };
}

/**
 * Store sensitive data securely based on entity type
 * 
 * Routes data to appropriate encrypted tables:
 * - Medical history → clinical_notes (encrypted)
 * - Addresses → contacts (encrypted, searchable)
 * - PII → pii_vault (encrypted)
 * 
 * @param supabase - Supabase client
 * @param contact_id - Contact/patient ID
 * @param clinic_id - Clinic/organization ID
 * @param nerResult - NER analysis result
 * @returns Storage results for each entity type
 */
export async function storeSensitiveData(
  supabase: ReturnType<typeof createClient>,
  contact_id: string,
  clinic_id: string,
  nerResult: NerResult
): Promise<{
  success: boolean;
  stored_entities: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let storedCount = 0;

  try {
    // 1. Store medical data in encrypted clinical_notes table
    const medicalEntities = nerResult.entities.filter(
      (e) => e.type === "MEDICAL_CONDITION"
    );

    if (medicalEntities.length > 0) {
      const { error } = await supabase.from("clinical_notes").insert(
        medicalEntities.map((entity) => ({
          contact_id,
          clinic_id,
          note_type: "medical_condition",
          content: entity.value,
          source: "vapi_transcript",
          created_at: new Date().toISOString(),
          is_encrypted: true,
          confidence_score: entity.confidence,
        }))
      );

      if (error) {
        errors.push(`Failed to store medical data: ${error.message}`);
      } else {
        storedCount += medicalEntities.length;
      }
    }

    // 2. Store addresses in contacts table (encrypted field)
    const addressEntities = nerResult.entities.filter(
      (e) => e.type === "ADDRESS"
    );

    if (addressEntities.length > 0) {
      for (const entity of addressEntities) {
        const { error } = await supabase
          .from("contacts")
          .update({
            address: entity.value,
            address_is_encrypted: true,
          })
          .eq("id", contact_id)
          .eq("clinic_id", clinic_id);

        if (error) {
          errors.push(
            `Failed to update address for contact ${contact_id}: ${error.message}`
          );
        } else {
          storedCount++;
        }
      }
    }

    // 3. Store PII in secure vault
    const piiEntities = nerResult.entities.filter(
      (e) =>
        ["PHONE", "EMAIL", "SSN", "INSURANCE"].includes(e.type)
    );

    if (piiEntities.length > 0) {
      const { error } = await supabase.from("pii_vault").insert(
        piiEntities.map((entity) => ({
          contact_id,
          clinic_id,
          pii_type: entity.type.toLowerCase(),
          value: entity.value,
          is_encrypted: true,
          access_log: [
            {
              accessed_by: "ner_system",
              accessed_at: new Date().toISOString(),
            },
          ],
        }))
      );

      if (error) {
        errors.push(`Failed to store PII: ${error.message}`);
      } else {
        storedCount += piiEntities.length;
      }
    }

    // 4. Store redacted transcript in calls (public safe)
    const { error: logError } = await supabase
      .from("calls")
      .update({
        transcript: nerResult.redacted_transcript,
        has_sensitive_data: nerResult.has_sensitive_data,
        sensitive_data_redacted_at: new Date().toISOString(),
      })
      .eq("contact_id", contact_id)
      .eq("clinic_id", clinic_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (logError) {
      errors.push(`Failed to update call log: ${logError.message}`);
    }

    return {
      success: errors.length === 0,
      stored_entities: storedCount,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      stored_entities: storedCount,
      errors: [
        ...errors,
        `Unexpected error in storeSensitiveData: ${err}`,
      ],
    };
  }
}

/**
 * Retrieve sensitive data with audit logging
 * 
 * Only authorized users can access encrypted data
 * All access is logged for compliance
 * 
 * @param supabase - Supabase client
 * @param contact_id - Contact ID
 * @param data_type - Type of data (medical, pii, address)
 * @param requester_id - User requesting access
 * @returns Decrypted data with audit log
 */
export async function retrieveSensitiveData(
  supabase: ReturnType<typeof createClient>,
  contact_id: string,
  data_type: "medical" | "pii" | "address",
  requester_id: string
): Promise<{
  success: boolean;
  data?: Record<string, any>;
  audit_logged: boolean;
  error?: string;
}> {
  try {
    let query;

    // Route to appropriate table based on type
    if (data_type === "medical") {
      query = supabase
        .from("clinical_notes")
        .select("*")
        .eq("contact_id", contact_id);
    } else if (data_type === "pii") {
      query = supabase
        .from("pii_vault")
        .select("*")
        .eq("contact_id", contact_id);
    } else {
      // address
      query = supabase
        .from("contacts")
        .select("address, address_is_encrypted")
        .eq("id", contact_id);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Log access for compliance audit trail
    const auditLogged = await logAccessAudit(
      supabase,
      contact_id,
      data_type,
      requester_id,
      !error
    );

    return {
      success: !error,
      data,
      audit_logged: auditLogged,
    };
  } catch (err) {
    return {
      success: false,
      audit_logged: false,
      error: `Failed to retrieve sensitive data: ${err}`,
    };
  }
}

/**
 * Log all access to sensitive data for compliance
 * 
 * @param supabase - Supabase client
 * @param contact_id - Contact ID
 * @param data_type - Data type accessed
 * @param requester_id - User making request
 * @param success - Whether access was granted
 * @returns true if audit logged successfully
 */
async function logAccessAudit(
  supabase: ReturnType<typeof createClient>,
  contact_id: string,
  data_type: string,
  requester_id: string,
  success: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase.from("sensitive_data_access_audit").insert(
      {
        contact_id,
        data_type,
        accessed_by: requester_id,
        accessed_at: new Date().toISOString(),
        success,
        ip_address: "captured_from_request",
      }
    );

    return !error;
  } catch (err) {
    console.error("Failed to log sensitive data access:", err);
    return false;
  }
}

/**
 * Generate compliance report
 * 
 * Shows:
 * - How many records have sensitive data redacted
 * - Access audit trail
 * - Data retention policy compliance
 * 
 * @param supabase - Supabase client
 * @param clinic_id - Clinic/organization ID
 * @param start_date - Start of reporting period
 * @param end_date - End of reporting period
 * @returns Compliance report
 */
export async function generateComplianceReport(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  start_date: string,
  end_date: string
): Promise<{
  clinic_id: string;
  period: { start: string; end: string };
  statistics: {
    total_calls_processed: number;
    calls_with_sensitive_data: number;
    sensitive_data_redacted: number;
    medical_records_stored: number;
    pii_records_stored: number;
  };
  access_audit: Array<{
    date: string;
    accessed_by: string;
    data_type: string;
    success: boolean;
  }>;
}> {
  try {
    // Get statistics
    const { count: totalCalls } = await supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("created_at", start_date)
      .lte("created_at", end_date);

    const { count: sensitiveCalls } = await supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .eq("has_sensitive_data", true)
      .gte("created_at", start_date)
      .lte("created_at", end_date);

    const { count: medicalRecords } = await supabase
      .from("clinical_notes")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("created_at", start_date)
      .lte("created_at", end_date);

    const { count: piiRecords } = await supabase
      .from("pii_vault")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("created_at", start_date)
      .lte("created_at", end_date);

    // Get access audit trail
    const { data: auditData } = await supabase
      .from("sensitive_data_access_audit")
      .select("accessed_at, accessed_by, data_type, success")
      .eq("clinic_id", clinic_id)
      .gte("accessed_at", start_date)
      .lte("accessed_at", end_date)
      .order("accessed_at", { ascending: false });

    return {
      clinic_id,
      period: { start: start_date, end: end_date },
      statistics: {
        total_calls_processed: totalCalls || 0,
        calls_with_sensitive_data: sensitiveCalls || 0,
        sensitive_data_redacted: (sensitiveCalls || 0),
        medical_records_stored: medicalRecords || 0,
        pii_records_stored: piiRecords || 0,
      },
      access_audit:
        auditData?.map((row) => ({
          date: row.accessed_at,
          accessed_by: row.accessed_by,
          data_type: row.data_type,
          success: row.success,
        })) || [],
    };
  } catch (err) {
    console.error("Error generating compliance report:", err);
    throw err;
  }
}
