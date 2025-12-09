import asyncio
import os
import uuid
from dotenv import load_dotenv
from roxanne_enhanced_orchestration import EnhancedVoiceOrchestrator, ConversationContext

load_dotenv()

async def main():
    print("🚀 Starting Capability Test...")
    
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    
    if not deepgram_key or not groq_key:
        print("❌ API keys missing!")
        return

    orchestrator = EnhancedVoiceOrchestrator(
        deepgram_api_key=deepgram_key,
        groq_api_key=groq_key
    )
    
    # Create a context to maintain state across turns
    # Use valid UUIDs for Supabase compatibility
    test_session_id = str(uuid.uuid4())
    test_user_id = str(uuid.uuid4())
    
    ctx = ConversationContext(
        call_sid=test_session_id, 
        stream_sid="test_stream",
        user_id=test_user_id
    )
    
    print(f"ℹ️ Session ID: {test_session_id}")
    print(f"ℹ️ User ID: {test_user_id}")
    
    print("\n🧪 Test 1: General Conversation")
    print("User: Hello, I'm interested in a consultation.")
    response = await orchestrator.process_text_input("Hello, I'm interested in a consultation.", ctx)
    # Response is already printed by the method, but we can inspect it if needed
    
    print("\n\n🧪 Test 2: Price Inquiry (Context Retention)")
    print("User: How much does a BBL cost?")
    response = await orchestrator.process_text_input("How much does a BBL cost?", ctx)

    print("\n✅ Test Complete")

if __name__ == "__main__":
    asyncio.run(main())
