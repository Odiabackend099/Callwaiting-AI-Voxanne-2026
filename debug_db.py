
import os
import asyncio
from supabase import create_client, Client

# Load env vars
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not set")
    exit(1)

async def check_tables():
    supabase: Client = create_client(url, key)
    
    # Try to insert a dummy log to checking connection or just list tables?
    # Listing tables via postgrest isn't direct. 
    # But we can try to select from 'user_settings'
    
    print(f"Checking 'user_settings' table...")
    try:
        # We can't list tables easily without SQL editor or specific permissions
        # But we can try to select 0 rows
        response = supabase.table('user_settings').select('*').limit(1).execute()
        print("user_settings exists. Rows:", len(response.data))
    except Exception as e:
        print(f"Error checking user_settings: {e}")

    print(f"Checking 'voice_sessions' table...")
    try:
        response = supabase.table('voice_sessions').select('*').limit(1).execute()
        print("voice_sessions exists. Rows:", len(response.data))
    except Exception as e:
        print(f"Error checking voice_sessions: {e}")

if __name__ == "__main__":
    # We call this synchronously because the python client is seemingly synchronous or we use the sync one?
    # The standard supabase-py client is synchronous for the main operations usually.
    # The snippet used 'async' but standard client is sync. 
    # Let's write sync code.
    
    supabase = create_client(url, key)
    
    print(f"Checking 'user_settings' table...")
    try:
        response = supabase.table('user_settings').select('*').limit(1).execute()
        print("user_settings OK. Info:", response)
    except Exception as e:
        print(f"Error checking user_settings: {e}")

    print(f"Checking 'voice_sessions' table...")
    try:
        response = supabase.table('voice_sessions').select('*').limit(1).execute()
        print("voice_sessions OK. Info:", response)
    except Exception as e:
        print(f"Error checking voice_sessions: {e}")
