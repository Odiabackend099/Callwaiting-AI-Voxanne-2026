import requests
import sys

def test_key(api_key):
    if api_key == "your-new-key-here":
        print("❌ Error: You are using the placeholder text. Please verify it is a real key starting with 'sk_'.")
        return

    print(f"Testing Key: {api_key[:4]}...{api_key[-4:]}")
    url = "https://api.elevenlabs.io/v1/user"
    headers = {"xi-api-key": api_key}
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        sub = data.get('subscription', {})
        print(f"✅ Success! Key is Valid.")
        print(f"   Tier: {sub.get('tier')}")
        print(f"   Usage: {sub.get('character_count')} / {sub.get('character_limit')} characters")
        print(f"   Can extend limit: {sub.get('can_extend_character_limit')}")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Message: {response.text}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        key = sys.argv[1]
    else:
        # instructions
        print("Usage: python3 test_elevenlabs.py <YOUR_API_KEY>")
        key = input("Or paste key here: ").strip()
        
    test_key(key)
