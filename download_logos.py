import urllib.request
import os
import time

logos = {
    "twilio.png": "https://logo.clearbit.com/twilio.com?size=512",
    "salesforce.png": "https://logo.clearbit.com/salesforce.com?size=512",
    "calendly.png": "https://logo.clearbit.com/calendly.com?size=512",
    "supabase.png": "https://logo.clearbit.com/supabase.com?size=512",
    "google-calendar.png": "https://logo.clearbit.com/google.com?size=512",
    "outlook.png": "https://logo.clearbit.com/microsoft.com?size=512",
    "hubspot.png": "https://logo.clearbit.com/hubspot.com?size=512",
    "pipedrive.png": "https://logo.clearbit.com/pipedrive.com?size=512",
    "monday.png": "https://logo.clearbit.com/monday.com?size=512",
    "elevenlabs.png": "https://logo.clearbit.com/elevenlabs.io?size=512",
    "vonage.png": "https://logo.clearbit.com/vonage.com?size=512",
    "vapi.png": "https://logo.clearbit.com/vapi.ai?size=512",
    "cal-com.png": "https://logo.clearbit.com/cal.com?size=512",
}

# Fallback URLs if Clearbit fails or returns small image
fallbacks = {
    "vapi.png": "https://vapi.ai/favicon.ico", 
    "cal-com.png": "https://cal.com/favicon.ico"
}

output_dir = "/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/public/integrations"
os.makedirs(output_dir, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0'}

for filename, url in logos.items():
    filepath = os.path.join(output_dir, filename)
    print(f"Downloading {filename} from {url}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = response.read()
            # Basic check if it's an image
            if len(data) > 100: 
                with open(filepath, 'wb') as f:
                    f.write(data)
                print(f"  ✓ Saved {filename} ({len(data)} bytes)")
            else:
                print(f"  ✗ Failed: content too small")
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        # Try fallback
        if filename in fallbacks:
            fallback_url = fallbacks[filename]
            print(f"  ↻ Trying fallback for {filename}: {fallback_url}")
            try:
                req = urllib.request.Request(fallback_url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    data = response.read()
                    with open(filepath, 'wb') as f:
                        f.write(data)
                print(f"  ✓ Saved fallback {filename} ({len(data)} bytes)")
            except Exception as e2:
                print(f"  ✗ Fallback failed: {e2}")

