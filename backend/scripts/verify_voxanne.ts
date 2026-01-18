import { getRagContext } from '../src/services/rag-context-provider';
import { handleVapiBookingRequest } from '../src/services/vapi-booking-handler';
import { log } from '../src/services/logger';

export async function runAutomatedTest() {
  const TEST_ORG_ID = "TEST_ORG_ID";
  const MY_PHONE_NUMBER = "+2348128772405";
  const CLINIC_TIMEZONE = "America/New_York";

  console.log("🚀 Starting Automated Voxanne Verification...");
  console.log(`⏰ Clinic Timezone: ${CLINIC_TIMEZONE}`);

  // 1. TEST RAG RETRIEVAL
  console.log("📝 Step 1: Querying Knowledge Base...");
  try {
    const { context: ragResponse } = await getRagContext(
      "What is the clinic's cancellation policy?", 
      TEST_ORG_ID
    );
    if (!ragResponse) {
      console.log("⚠️ RAG Service: Knowledge base query failed (check OpenAI API key)");
    } else {
      console.log("RAG Output:", ragResponse);
    }
  } catch (error) {
    console.log("⚠️ RAG Service Error:", error instanceof Error ? error.message : String(error));
  }

  // 2. TEST CALENDAR BOOKING
  console.log("📅 Step 2: Booking Monday, Jan 19, 2026 @ 9:00 AM...");
  try {
    const booking = await handleVapiBookingRequest(
      "Bearer YOUR_VALID_JWT_TOKEN", // Replace with actual JWT
      {
        provider_id: "test-provider-id",
        appointment_date: "2026-01-19",
        appointment_time: "09:00",
        duration_minutes: 30
      }
    );
    console.log("Calendar Result:", booking);
  } catch (error) {
    console.log("⚠️ Booking Error:", error instanceof Error ? error.message : String(error));
    console.log("ℹ️ Note: Ensure you have a valid JWT token with org_id claim");
  }

  // 3. TEST SMS DISPATCH (Mocked)
  console.log("📱 Step 3: Mocking SMS Confirmation...");
  console.log("SMS would be sent to:", MY_PHONE_NUMBER);
  console.log("Message content: Your appointment is booked.");

  console.log("✅ Verification Complete. Check logs above for any warnings.");
}

runAutomatedTest();
