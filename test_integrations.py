import asyncio
import os
import logging
from voxanne_enhanced_orchestration import EnhancedVoiceOrchestrator, ConversationContext
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("IntegrationTest")

async def main():
    load_dotenv()
    
    print("🚀 Starting Integration Test...")
    
    # Check keys
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    n8n_url = os.getenv("N8N_WEBHOOK_BASE")
    serpapi_key = os.getenv("SERPAPI_KEY")
    
    if not all([deepgram_key, groq_key]):
        print("❌ Critical API keys (Deepgram/Groq) missing!")
        return

    print(f"Checking specific integration keys:")
    print(f"Supabase: {'✅ Found' if supabase_url and supabase_key else '❌ Missing'}")
    print(f"N8N: {'✅ Found' if n8n_url else '❌ Missing'}")
    print(f"SerpApi: {'✅ Found' if serpapi_key else '❌ Missing'}")

    orchestrator = EnhancedVoiceOrchestrator(
        deepgram_api_key=deepgram_key,
        groq_api_key=groq_key
    )
    
    # Test Supabase
    print("\n🧪 Test 1: Supabase Logging")
    ctx = ConversationContext(call_sid="test_integration_sid", stream_sid="test_stream")
    try:
        orchestrator._log_interaction_supabase(
            ctx, 
            "test_log", 
            {"message": "Integration test run", "status": "success"}
        )
        print("✅ Supabase log triggered (async)")
    except Exception as e:
        print(f"❌ Supabase test failed: {e}")

    # Test SerpApi
    print("\n🧪 Test 2: SerpApi Search")
    if serpapi_key:
        try:
            result = await orchestrator._search_serpapi("Cosmetic Surgery Trends 2025")
            print(f"✅ Search Result: {result[:100]}...")
        except Exception as e:
            print(f"❌ SerpApi test failed: {e}")
    else:
        print("⚠️ Skipping SerpApi test (Key missing)")

    # Test N8N
    print("\n🧪 Test 3: N8N Webhook")
    if n8n_url:
        try:
            success = await orchestrator._trigger_n8n_webhook(
                "test_action", 
                {"test_data": "verification_run"}
            )
            print(f"✅ N8N Trigger: {'Success' if success else 'Failed'}")
        except Exception as e:
            print(f"❌ N8N test failed: {e}")
    else:
        print("⚠️ Skipping N8N test (URL missing)")

    print("\n✅ Integration Verification Complete")

if __name__ == "__main__":
    asyncio.run(main())
