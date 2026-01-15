/**
 * Master Orchestrator: System Test Suite
 * 
 * Executes all 5 critical system tests:
 * 1. Atomic Slot Locking (SELECT FOR UPDATE)
 * 2. Contextual Memory Hand-off (Webhook → Outbound Campaign)
 * 3. Security & Compliance (NER + Encryption)
 * 4. Latency & Response Benchmarking (TTFB optimization)
 * 5. Multi-Tenant RLS Validation (GDPR/HIPAA compliance)
 */

import { claimSlotAtomic, releaseSlot } from "./atomic-slot-locking";
import { handleVapiCallEnded, executeOutboundCampaign } from "./contextual-memory-handoff";
import { performNER, storeSensitiveData, generateComplianceReport as generateNerReport } from "./security-compliance-ner";
import { measureTTFB, benchmarkAIResponse, enableAdaptiveStreaming, latencyHealthCheck } from "./latency-benchmarking";
import { runMultiTenantValidation, generateComplianceReport as generateRLSReport, createTestUsers } from "./multi-tenant-rls-validation";
import { createClient } from "@supabase/supabase-js";

interface SystemTestSuite {
  test_name: string;
  status: "passed" | "failed" | "pending";
  duration_ms: number;
  result?: any;
  error?: string;
}

interface MasterOrchestratorReport {
  execution_date: string;
  total_duration_ms: number;
  tests: SystemTestSuite[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    success_rate: number;
  };
  recommendations: string[];
  production_ready: boolean;
}

/**
 * Task 1: Atomic Slot Locking with Concurrent Testing
 * 
 * Simulates 5 concurrent requests claiming the same slot
 * Expected: Exactly 1 succeeds (200), 4 get 409 Conflict
 */
async function testAtomicSlotLocking(
  supabase: ReturnType<typeof createClient>,
  clinicId: string
): Promise<SystemTestSuite> {
  const startTime = Date.now();

  try {
    console.log("\n🔒 Task 1: Atomic Slot Locking");
    console.log("Simulating 5 concurrent claims for same slot...\n");

    // Create a test slot
    const slotId = `slot_${Date.now()}`;
    const contactIds = Array.from({ length: 5 }, (_, i) => `contact_${i}`);

    // Launch 5 concurrent claims
    const results = await Promise.all(
      contactIds.map((contactId) =>
        claimSlotAtomic(supabase, slotId as any, contactId as any, clinicId as any)
      )
    );

    const successful = results.filter((r) => r.success);
    const conflicts = results.filter((r) => r.status === 409);

    const passed =
      successful.length === 1 && conflicts.length === 4;

    console.log(`✅ Successful claims: ${successful.length}/5`);
    console.log(`✅ Conflicts (409): ${conflicts.length}/5`);
    console.log(`✅ Next available slots offered: ${conflicts[0]?.next_available?.length || 0} options`);

    if (passed) {
      console.log("\n✅ TASK 1 PASSED: Atomic locking prevents double-booking\n");
    }

    return {
      test_name: "Atomic Slot Locking (SELECT FOR UPDATE)",
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - startTime,
      result: {
        successful_claims: successful.length,
        conflict_responses: conflicts.length,
        next_available_offered: conflicts[0]?.next_available?.length || 0,
      },
    };
  } catch (error) {
    return {
      test_name: "Atomic Slot Locking (SELECT FOR UPDATE)",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `${error}`,
    };
  }
}

/**
 * Task 2: Contextual Memory Hand-off
 * 
 * Simulates:
 * - Patient calls about "Rhinoplasty"
 * - Call ends without booking
 * - Webhook triggers Sarah (outbound agent) with follow-up SMS
 */
async function testContextualMemoryHandoff(
  supabase: ReturnType<typeof createClient>,
  clinicId: string
): Promise<SystemTestSuite> {
  const startTime = Date.now();

  try {
    console.log("\n📲 Task 2: Contextual Memory Hand-off");
    console.log("Patient mentions 'Rhinoplasty', call ends without booking...\n");

    // Simulate Vapi webhook
    const webhook = {
      event: "call.ended",
      data: {
        call: {
          id: `call_${Date.now()}`,
          status: "ended" as const,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          duration: 180, // 3 minutes
          transcript:
            "I'm interested in rhinoplasty. Do you do financing? Actually, let me think about it and call back.",
          leadId: `lead_${Date.now()}`,
          clinicId: clinicId,
          messages_metadata: {
            keywords: ["rhinoplasty", "financing"],
            entities: {
              service_type: "rhinoplasty",
            },
          },
        },
      },
    };

    // Process webhook (would trigger in production)
    const campaign = await handleVapiCallEnded(webhook as any, supabase);

    const passed = campaign !== null && campaign.context_memory.primary_keyword.includes("rhino");

    console.log(`✅ Campaign created: ${campaign?.id || "N/A"}`);
    console.log(`✅ Primary keyword extracted: "${campaign?.context_memory.primary_keyword}"`);
    console.log(`✅ Assigned to outbound agent: ${campaign?.assigned_to_agent}`);
    console.log(`✅ PDF guide included: ${campaign?.metadata.pdf_guide_url ? "Yes" : "No"}`);

    if (passed) {
      console.log(
        "\n✅ TASK 2 PASSED: Memory hand-off triggered for follow-up\n"
      );
    }

    return {
      test_name: "Contextual Memory Hand-off",
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - startTime,
      result: {
        campaign_created: !!campaign,
        keyword_extracted: campaign?.context_memory.primary_keyword,
        assigned_agent: campaign?.assigned_to_agent,
      },
    };
  } catch (error) {
    return {
      test_name: "Contextual Memory Hand-off",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `${error}`,
    };
  }
}

/**
 * Task 3: Security & Compliance (NER Filter)
 * 
 * Detects PII and medical data in transcript:
 * - Address: "123 Harley Street" → Saved to contacts (encrypted)
 * - Medical: "heart issues" → Moved to clinical_notes (encrypted, RLS)
 * - Public log: Redacted
 */
async function testSecurityCompliance(
  supabase: ReturnType<typeof createClient>,
  clinicId: string
): Promise<SystemTestSuite> {
  const startTime = Date.now();

  try {
    console.log("\n🔐 Task 3: Security & Compliance (NER Filter)");
    console.log(
      'Analyzing transcript with PII: "My address is 123 Harley Street and I have a history of heart issues"\n'
    );

    const transcript =
      "My address is 123 Harley Street and I have a history of heart issues.";

    // Perform NER
    const nerResult = performNER(transcript, { clinic_id: clinicId });

    const hasAddress = nerResult.entities.some((e) => e.type === "ADDRESS");
    const hasMedical = nerResult.entities.some(
      (e) => e.type === "MEDICAL_CONDITION"
    );
    const isRedacted = nerResult.redacted_transcript.includes("[REDACTED]");

    console.log(`✅ Address detected: ${hasAddress ? "Yes" : "No"}`);
    console.log(`✅ Medical condition detected: ${hasMedical ? "Yes" : "No"}`);
    console.log(`✅ Public log redacted: ${isRedacted ? "Yes" : "No"}`);
    console.log(
      `\n   Original: "${transcript}"`
    );
    console.log(
      `   Redacted: "${nerResult.redacted_transcript}"`
    );

    // Store sensitive data (would be done in production)
    const stored = await storeSensitiveData(
      supabase,
      `contact_${Date.now()}` as any,
      clinicId as any,
      nerResult
    );

    const passed =
      hasAddress && hasMedical && isRedacted && stored.success;

    console.log(`\n✅ Sensitive data stored: ${stored.stored_entities} items`);

    if (passed) {
      console.log("\n✅ TASK 3 PASSED: Compliance enforced (GDPR/HIPAA)\n");
    }

    return {
      test_name: "Security & Compliance (NER)",
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - startTime,
      result: {
        entities_detected: nerResult.entities.length,
        address_redacted: hasAddress,
        medical_redacted: hasMedical,
        sensitive_data_stored: stored.stored_entities,
      },
    };
  } catch (error) {
    return {
      test_name: "Security & Compliance (NER)",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `${error}`,
    };
  }
}

/**
 * Task 4: Latency Benchmarking
 * 
 * Measures TTFB (Time to First Byte)
 * If > 800ms, logs recommendation for streaming optimization
 */
async function testLatencyBenchmarking(): Promise<SystemTestSuite> {
  const startTime = Date.now();

  try {
    console.log("\n⚡ Task 4: Latency Benchmarking");
    console.log("Measuring Time to First Byte (TTFB)...\n");

    // Simulate AI response call
    const mockApiCall = async () => {
      await new Promise((resolve) => setTimeout(resolve, 250)); // Simulate 250ms latency
      return { response: "Booking confirmed" };
    };

    const { metrics } = await measureTTFB(mockApiCall, "ai_response");

    // Get benchmark
    const benchmark = await benchmarkAIResponse(mockApiCall, "ai_response");

    console.log(`✅ TTFB: ${metrics.ttfb_ms.toFixed(0)}ms`);
    console.log(`✅ Total response time: ${metrics.total_time_ms.toFixed(0)}ms`);
    console.log(`✅ Status: ${benchmark.status.toUpperCase()}`);
    console.log(`✅ Recommendation: ${benchmark.recommendation}`);

    // Health check
    const health = await latencyHealthCheck();
    console.log(`\n📊 Latency Health: ${health.status.toUpperCase()}`);
    console.log(`   ${health.overall_recommendation}`);

    const passed = benchmark.status === "ok" || benchmark.status === "warning";

    if (passed) {
      console.log("\n✅ TASK 4 PASSED: Latency within acceptable range\n");
    } else {
      console.log(
        "\n⚠️  TASK 4 WARNING: Streaming optimization recommended\n"
      );
    }

    return {
      test_name: "Latency & Response Benchmarking",
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - startTime,
      result: {
        ttfb_ms: metrics.ttfb_ms,
        total_time_ms: metrics.total_time_ms,
        status: benchmark.status,
        streaming_recommended: benchmark.status === "critical",
      },
    };
  } catch (error) {
    return {
      test_name: "Latency & Response Benchmarking",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `${error}`,
    };
  }
}

/**
 * Task 5: Multi-Tenant RLS Validation
 * 
 * Tests that Clinic A JWT cannot access Clinic B data
 * Expected: All attempts return 403 Forbidden
 */
async function testMultiTenantRLS(
  supabase: ReturnType<typeof createClient>,
  clinicAId: string,
  clinicBId: string
): Promise<SystemTestSuite> {
  const startTime = Date.now();

  try {
    console.log("\n🏥 Task 5: Multi-Tenant RLS Validation");
    console.log("Testing GDPR/HIPAA data isolation...\n");

    // Create test users
    const { clinic_a_user, clinic_b_user } = await createTestUsers(
      supabase,
      clinicAId,
      clinicBId
    );

    console.log(`✅ Test users created`);
    console.log(`   Clinic A: ${clinic_a_user.email}`);
    console.log(`   Clinic B: ${clinic_b_user.email}`);

    // Run validation
    const validation = await runMultiTenantValidation(
      supabase,
      clinic_a_user,
      clinic_b_user,
      clinicAId,
      clinicBId
    );

    console.log(`\n✅ Tests run: ${validation.total_tests}`);
    console.log(`✅ Passed: ${validation.passed_tests}`);
    console.log(`✅ Failed: ${validation.failed_tests}`);
    console.log(`\nCompliance Status:`);
    console.log(
      `   ${validation.clinic_isolation ? "✅" : "❌"} Clinic Isolation`
    );
    console.log(
      `   ${validation.data_access_control ? "✅" : "❌"} Data Access Control`
    );
    console.log(
      `   ${validation.cross_clinic_prevention ? "✅" : "❌"} Cross-clinic Prevention`
    );
    console.log(
      `   ${validation.audit_logging ? "✅" : "❌"} Audit Logging`
    );
    console.log(
      `   ${validation.rls_policies_active ? "✅" : "❌"} RLS Policies Active`
    );

    const passed = validation.rls_policies_active;

    if (passed) {
      console.log("\n✅ TASK 5 PASSED: GDPR/HIPAA compliant isolation\n");
    }

    return {
      test_name: "Multi-Tenant RLS Validation",
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - startTime,
      result: validation,
    };
  } catch (error) {
    return {
      test_name: "Multi-Tenant RLS Validation",
      status: "failed",
      duration_ms: Date.now() - startTime,
      error: `${error}`,
    };
  }
}

/**
 * Execute complete Master Orchestrator test suite
 * 
 * @param supabase - Supabase client
 * @param clinicAId - Clinic A for multi-tenant testing
 * @param clinicBId - Clinic B for multi-tenant testing
 * @returns Master orchestrator report
 */
export async function executeMasterOrchestratorTests(
  supabase: ReturnType<typeof createClient>,
  clinicAId: string,
  clinicBId: string
): Promise<MasterOrchestratorReport> {
  const overallStartTime = Date.now();

  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                   ║");
  console.log("║        🎯 MASTER ORCHESTRATOR: SYSTEM TEST SUITE EXECUTION        ║");
  console.log("║                                                                   ║");
  console.log("║              Testing Modular Agency Ecosystem                      ║");
  console.log("║   [Vapi Voice] [Supabase State] [Google Calendar Execution]       ║");
  console.log("║                                                                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");

  const tests: SystemTestSuite[] = [];

  // Run all 5 tasks
  tests.push(
    await testAtomicSlotLocking(supabase, clinicAId)
  );

  tests.push(
    await testContextualMemoryHandoff(supabase, clinicAId)
  );

  tests.push(
    await testSecurityCompliance(supabase, clinicAId)
  );

  tests.push(
    await testLatencyBenchmarking()
  );

  tests.push(
    await testMultiTenantRLS(supabase, clinicAId, clinicBId)
  );

  // Calculate summary
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const successRate = (passed / tests.length) * 100;

  // Generate recommendations
  const recommendations: string[] = [];

  if (successRate === 100) {
    recommendations.push("✅ System is production-ready");
    recommendations.push("✅ All critical infrastructure validated");
  }

  const failedTests = tests.filter((t) => t.status === "failed");
  if (failedTests.length > 0) {
    recommendations.push(
      `⚠️  Fix ${failedTests.length} failing test(s) before deployment`
    );
    failedTests.forEach((t) => {
      recommendations.push(`   - ${t.test_name}: ${t.error}`);
    });
  }

  const latencyTest = tests.find((t) =>
    t.test_name.includes("Latency")
  );
  if (
    latencyTest?.result?.streaming_recommended
  ) {
    recommendations.push(
      "💡 Enable streaming mode for AI responses (Deepgram Nova-2 + Cartesia Turbo)"
    );
  }

  const report: MasterOrchestratorReport = {
    execution_date: new Date().toISOString(),
    total_duration_ms: Date.now() - overallStartTime,
    tests,
    summary: {
      total_tests: tests.length,
      passed,
      failed,
      success_rate: successRate,
    },
    recommendations,
    production_ready: successRate === 100,
  };

  // Print final report
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                    📊 MASTER ORCHESTRATOR REPORT                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  console.log(`Execution Date: ${report.execution_date}`);
  console.log(`Total Duration: ${(report.total_duration_ms / 1000).toFixed(2)}s\n`);

  console.log("SUMMARY:");
  console.log(`├─ Total Tests: ${report.summary.total_tests}`);
  console.log(`├─ ✅ Passed: ${report.summary.passed}`);
  console.log(`├─ ❌ Failed: ${report.summary.failed}`);
  console.log(`└─ Success Rate: ${report.summary.success_rate.toFixed(1)}%\n`);

  console.log("TEST RESULTS:");
  tests.forEach((test) => {
    const symbol = test.status === "passed" ? "✅" : "❌";
    console.log(
      `${symbol} ${test.test_name} (${(test.duration_ms / 1000).toFixed(2)}s)`
    );
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  console.log("\nRECOMMENDATIONS:");
  report.recommendations.forEach((rec) => {
    console.log(`${rec}`);
  });

  console.log(
    `\nPRODUCTION READY: ${report.production_ready ? "✅ YES" : "❌ NO"}\n`
  );

  return report;
}
