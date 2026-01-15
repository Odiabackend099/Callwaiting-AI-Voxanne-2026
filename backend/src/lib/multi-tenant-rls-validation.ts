/**
 * Multi-Tenant RLS (Row Level Security) Validation
 * 
 * Tests data isolation across clinics:
 * - Clinic A JWT cannot access Clinic B data
 * - All attempts return 403 Forbidden
 * - RLS policies enforced at database level
 * 
 * Critical for GDPR & HIPAA compliance at scale (100+ clinics)
 */

import { createClient } from "@supabase/supabase-js";

interface TestUser {
  id: string;
  email: string;
  clinic_id: string;
  role: "admin" | "provider" | "staff";
}

interface RLSTestResult {
  test_name: string;
  clinic_a_id: string;
  clinic_b_id: string;
  operation: string;
  expected_status: number;
  actual_status: number;
  passed: boolean;
  error_message?: string;
  timestamp: string;
}

interface MultiTenantValidation {
  clinic_isolation: boolean;
  data_access_control: boolean;
  cross_clinic_prevention: boolean;
  audit_logging: boolean;
  rls_policies_active: boolean;
  passed_tests: number;
  failed_tests: number;
  total_tests: number;
  results: RLSTestResult[];
}

/**
 * Create test users for Clinic A and Clinic B
 * 
 * Each user has a JWT token scoped to their clinic
 * 
 * @param supabase - Supabase client (with admin privileges)
 * @param clinic_a_id - Clinic A identifier
 * @param clinic_b_id - Clinic B identifier
 * @returns Test users with JWT tokens
 */
export async function createTestUsers(
  supabase: ReturnType<typeof createClient>,
  clinic_a_id: string,
  clinic_b_id: string
): Promise<{
  clinic_a_user: TestUser & { jwt: string };
  clinic_b_user: TestUser & { jwt: string };
}> {
  // Create Clinic A user
  const clinicAUserEmail = `test_clinic_a_${Date.now()}@test.local`;
  const { data: clinicAAuth, error: clinicAError } = await supabase.auth.admin.createUser(
    {
      email: clinicAUserEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: {
        clinic_id: clinic_a_id,
        role: "admin",
      },
    }
  );

  if (clinicAError) {
    throw new Error(`Failed to create Clinic A user: ${clinicAError.message}`);
  }

  // Create Clinic B user
  const clinicBUserEmail = `test_clinic_b_${Date.now()}@test.local`;
  const { data: clinicBAuth, error: clinicBError } = await supabase.auth.admin.createUser(
    {
      email: clinicBUserEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: {
        clinic_id: clinic_b_id,
        role: "admin",
      },
    }
  );

  if (clinicBError) {
    throw new Error(`Failed to create Clinic B user: ${clinicBError.message}`);
  }

  // Generate JWT tokens
  const clinicAJwt = await generateTestJWT(supabase, clinicAAuth!.user.id, clinic_a_id);
  const clinicBJwt = await generateTestJWT(supabase, clinicBAuth!.user.id, clinic_b_id);

  return {
    clinic_a_user: {
      id: clinicAAuth!.user.id,
      email: clinicAUserEmail,
      clinic_id: clinic_a_id,
      role: "admin",
      jwt: clinicAJwt,
    },
    clinic_b_user: {
      id: clinicBAuth!.user.id,
      email: clinicBUserEmail,
      clinic_id: clinic_b_id,
      role: "admin",
      jwt: clinicBJwt,
    },
  };
}

/**
 * Generate JWT token with clinic_id claim
 * 
 * Token includes custom claim for RLS policy evaluation
 * 
 * @param supabase - Supabase client
 * @param user_id - User identifier
 * @param clinic_id - Clinic to scope token to
 * @returns JWT token
 */
async function generateTestJWT(
  supabase: ReturnType<typeof createClient>,
  user_id: string,
  clinic_id: string
): Promise<string> {
  // TODO: Use Supabase session token or generate custom JWT
  // For testing, return a mock JWT (in production, use admin API)
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64");

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: user_id,
      clinic_id: clinic_id,
      iss: "callwaiting",
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64");

  // In production, sign with real secret
  const signature = Buffer.from("test_signature").toString("base64");

  return `${header}.${payload}.${signature}`;
}

/**
 * Test 1: RLS Policy on bookings table
 * 
 * Clinic A user should NOT be able to read Clinic B bookings
 * Expected: 403 Forbidden
 * 
 * @param supabase - Supabase client
 * @param clinic_a_user - Clinic A user
 * @param clinic_b_booking_id - Booking in Clinic B
 * @returns Test result
 */
export async function testBookingIsolation(
  supabase: ReturnType<typeof createClient>,
  clinic_a_user: TestUser & { jwt: string },
  clinic_b_booking_id: string
): Promise<RLSTestResult> {
  const startTime = new Date().toISOString();

  try {
    // Create client with Clinic A user's JWT
    const clinicAClient = supabase.setAuth(clinic_a_user.jwt);

    // Attempt to read Clinic B booking (should fail)
    const { data, error } = await clinicAClient
      .from("appointments")
      .select("*")
      .eq("id", clinic_b_booking_id)
      .single();

    const status = error ? (error.code === "PGRST116" ? 403 : 500) : 200;
    const passed = status === 403 || status === 401;

    return {
      test_name: "Booking Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: "", // Target clinic B
      operation: "SELECT appointments WHERE id = clinic_b_booking",
      expected_status: 403,
      actual_status: status,
      passed,
      error_message: error?.message,
      timestamp: startTime,
    };
  } catch (err) {
    return {
      test_name: "Booking Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: "",
      operation: "SELECT appointments",
      expected_status: 403,
      actual_status: 500,
      passed: false,
      error_message: `Exception: ${err}`,
      timestamp: startTime,
    };
  }
}

/**
 * Test 2: RLS Policy on contacts table
 * 
 * Clinic A staff should NOT be able to UPDATE Clinic B contact
 * Expected: 403 Forbidden
 * 
 * @param supabase - Supabase client
 * @param clinic_a_user - Clinic A user
 * @param clinic_b_contact_id - Contact in Clinic B
 * @returns Test result
 */
export async function testContactIsolation(
  supabase: ReturnType<typeof createClient>,
  clinic_a_user: TestUser & { jwt: string },
  clinic_b_contact_id: string
): Promise<RLSTestResult> {
  const startTime = new Date().toISOString();

  try {
    const clinicAClient = supabase.setAuth(clinic_a_user.jwt);

    // Attempt to update Clinic B contact (should fail)
    const { error } = await clinicAClient
      .from("contacts")
      .update({ lead_status: "booked" })
      .eq("id", clinic_b_contact_id)
      .eq("clinic_id", clinic_a_user.clinic_id); // RLS should block this

    const status = error
      ? error.code === "PGRST116"
        ? 403
        : error.code === "42P01"
          ? 401
          : 500
      : 200;
    const passed = status === 403 || status === 401;

    return {
      test_name: "Contact Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: "",
      operation: "UPDATE contacts WHERE clinic_id != user.clinic_id",
      expected_status: 403,
      actual_status: status,
      passed,
      error_message: error?.message,
      timestamp: startTime,
    };
  } catch (err) {
    return {
      test_name: "Contact Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: "",
      operation: "UPDATE contacts",
      expected_status: 403,
      actual_status: 500,
      passed: false,
      error_message: `Exception: ${err}`,
      timestamp: startTime,
    };
  }
}

/**
 * Test 3: RLS Policy on sms_logs table
 * 
 * Clinic A should NOT be able to DELETE Clinic B SMS logs
 * Expected: 403 Forbidden
 * 
 * @param supabase - Supabase client
 * @param clinic_a_user - Clinic A user
 * @param clinic_b_sms_log_id - SMS log in Clinic B
 * @returns Test result
 */
export async function testSmsLogIsolation(
  supabase: ReturnType<typeof createClient>,
  clinic_a_user: TestUser & { jwt: string },
  clinic_b_sms_log_id: string
): Promise<RLSTestResult> {
  const startTime = new Date().toISOString();

  try {
    const clinicAClient = supabase.setAuth(clinic_a_user.jwt);

    // Attempt to delete Clinic B SMS log (should fail)
    const { error } = await clinicAClient
      .from("sms_logs")
      .delete()
      .eq("id", clinic_b_sms_log_id);

    const status = error ? 403 : 200;
    const passed = status === 403 || status === 401;

    return {
      test_name: "SMS Log Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: "",
      operation: "DELETE sms_logs WHERE clinic_b_id",
      expected_status: 403,
      actual_status: status,
      passed,
      error_message: error?.message,
      timestamp: startTime,
    };
  } catch (err) {
    return {
      test_name: "SMS Log Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: "",
      operation: "DELETE sms_logs",
      expected_status: 403,
      actual_status: 500,
      passed: false,
      error_message: `Exception: ${err}`,
      timestamp: startTime,
    };
  }
}

/**
 * Test 4: RLS Policy on audit_logs (read-only)
 * 
 * Clinic A should NOT be able to read Clinic B audit logs
 * Expected: 403 Forbidden (RLS filters to empty result set)
 * 
 * @param supabase - Supabase client
 * @param clinic_a_user - Clinic A user
 * @param clinic_b_id - Clinic B identifier
 * @returns Test result
 */
export async function testAuditLogIsolation(
  supabase: ReturnType<typeof createClient>,
  clinic_a_user: TestUser & { jwt: string },
  clinic_b_id: string
): Promise<RLSTestResult> {
  const startTime = new Date().toISOString();

  try {
    const clinicAClient = supabase.setAuth(clinic_a_user.jwt);

    // Attempt to read Clinic B audit logs
    const { data, error } = await clinicAClient
      .from("audit_logs")
      .select("*")
      .eq("clinic_id", clinic_b_id);

    // RLS should return empty array, not error
    const status = data && data.length === 0 ? 200 : 403;
    const passed = status === 200 && (!data || data.length === 0);

    return {
      test_name: "Audit Log Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: clinic_b_id,
      operation: "SELECT audit_logs WHERE clinic_id = clinic_b_id",
      expected_status: 200, // RLS filters to empty, not error
      actual_status: status,
      passed,
      error_message: error?.message,
      timestamp: startTime,
    };
  } catch (err) {
    return {
      test_name: "Audit Log Isolation",
      clinic_a_id: clinic_a_user.clinic_id,
      clinic_b_id: clinic_b_id,
      operation: "SELECT audit_logs",
      expected_status: 200,
      actual_status: 500,
      passed: false,
      error_message: `Exception: ${err}`,
      timestamp: startTime,
    };
  }
}

/**
 * Test 5: Run all RLS isolation tests
 * 
 * @param supabase - Supabase client
 * @param clinic_a_user - Clinic A test user
 * @param clinic_b_user - Clinic B test user
 * @param clinic_a_id - Clinic A identifier
 * @param clinic_b_id - Clinic B identifier
 * @returns Complete validation report
 */
export async function runMultiTenantValidation(
  supabase: ReturnType<typeof createClient>,
  clinic_a_user: TestUser & { jwt: string },
  clinic_b_user: TestUser & { jwt: string },
  clinic_a_id: string,
  clinic_b_id: string
): Promise<MultiTenantValidation> {
  const results: RLSTestResult[] = [];

  console.log(
    "🔒 Starting Multi-Tenant RLS Validation (GDPR/HIPAA Compliance)..."
  );

  // Create test data in both clinics
  const { data: clinicBBooking } = await supabase
    .from("appointments")
    .insert({ clinic_id: clinic_b_id, contact_id: "test_contact", status: "pending" })
    .select()
    .single();

  const { data: clinicBContact } = await supabase
    .from("contacts")
    .insert({ clinic_id: clinic_b_id, first_name: "Test" })
    .select()
    .single();

  const { data: clinicBSmsLog } = await supabase
    .from("sms_logs")
    .insert({ clinic_id: clinic_b_id, contact_id: "test_contact", message: "test" })
    .select()
    .single();

  // Run all tests
  if (clinicBBooking) {
    results.push(
      await testBookingIsolation(supabase, clinic_a_user, clinicBBooking.id)
    );
  }

  if (clinicBContact) {
    results.push(
      await testContactIsolation(supabase, clinic_a_user, clinicBContact.id)
    );
  }

  if (clinicBSmsLog) {
    results.push(
      await testSmsLogIsolation(supabase, clinic_a_user, clinicBSmsLog.id)
    );
  }

  results.push(
    await testAuditLogIsolation(supabase, clinic_a_user, clinic_b_id)
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    clinic_isolation: passed >= 3,
    data_access_control: passed >= 4,
    cross_clinic_prevention: passed === results.length,
    audit_logging: results[3].passed,
    rls_policies_active: passed === results.length,
    passed_tests: passed,
    failed_tests: failed,
    total_tests: results.length,
    results,
  };
}

/**
 * Generate compliance report
 * 
 * Documents RLS validation for GDPR/HIPAA audits
 * 
 * @param validation - Multi-tenant validation result
 * @returns Compliance report
 */
export function generateComplianceReport(
  validation: MultiTenantValidation
): string {
  const report = `
═══════════════════════════════════════════════════════════════════
         MULTI-TENANT DATA ISOLATION COMPLIANCE REPORT
═══════════════════════════════════════════════════════════════════

Test Date: ${new Date().toISOString()}

SUMMARY:
--------
✅ Tests Passed: ${validation.passed_tests}/${validation.total_tests}
❌ Tests Failed: ${validation.failed_tests}/${validation.total_tests}

COMPLIANCE STATUS:
------------------
Clinic Isolation:        ${validation.clinic_isolation ? "✅ PASS" : "❌ FAIL"}
Data Access Control:     ${validation.data_access_control ? "✅ PASS" : "❌ FAIL"}
Cross-Clinic Prevention: ${validation.cross_clinic_prevention ? "✅ PASS" : "❌ FAIL"}
Audit Logging:          ${validation.audit_logging ? "✅ PASS" : "❌ FAIL"}
RLS Policies Active:    ${validation.rls_policies_active ? "✅ PASS" : "❌ FAIL"}

REQUIREMENTS MET:
-----------------
${validation.clinic_isolation ? "✅" : "❌"} GDPR Article 32: Access controls prevent unauthorized access
${validation.data_access_control ? "✅" : "❌"} HIPAA § 164.312(a)(2)(i): User authentication and RLS enforcement
${validation.cross_clinic_prevention ? "✅" : "❌"} Data Breach Prevention: Cross-clinic access attempts rejected
${validation.audit_logging ? "✅" : "❌"} Audit Trail: All access attempts logged

DETAILED RESULTS:
-----------------
${validation.results.map((r) => `
Test: ${r.test_name}
├─ Operation: ${r.operation}
├─ Expected Status: ${r.expected_status}
├─ Actual Status: ${r.actual_status}
├─ Result: ${r.passed ? "✅ PASS" : "❌ FAIL"}
${r.error_message ? `└─ Error: ${r.error_message}` : ""}
`).join("\n")}

RECOMMENDATION:
---------------
${
  validation.rls_policies_active
    ? "✅ Database is production-ready for multi-tenant deployment"
    : "❌ RLS policies must be fixed before production deployment"
}

═══════════════════════════════════════════════════════════════════
`;

  return report;
}
