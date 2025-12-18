import requests

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/webhooks/vapi"
TIMEOUT = 30

def test_post_api_webhooks_vapi_webhook_processing():
    headers = {
        "Content-Type": "application/json",
    }

    # Prepare sample webhook event payloads for different event types: call started, ended, transcript, and recording
    webhook_events = [
        # Call Started event
        {
            "event": "call.started",
            "call_id": "call_12345",
            "timestamp": "2025-12-10T10:00:00Z",
            "caller": "+1234567890",
            "callee": "+0987654321",
            "direction": "inbound",
            "vapiAgentId": "agent_001",
            "vapiAgentVoice": "female_english"
        },
        # Call Ended event
        {
            "event": "call.ended",
            "call_id": "call_12345",
            "timestamp": "2025-12-10T10:05:00Z",
            "duration": 300,
            "status": "completed"
        },
        # Transcript event
        {
            "event": "call.transcript",
            "call_id": "call_12345",
            "timestamp": "2025-12-10T10:02:00Z",
            "transcript": [
                {"speaker": "agent", "text": "Hello, how can I help you today?"},
                {"speaker": "caller", "text": "I have a question about my appointment."}
            ]
        },
        # Recording event
        {
            "event": "call.recording",
            "call_id": "call_12345",
            "timestamp": "2025-12-10T10:05:10Z",
            "recording_url": "https://storage.example.com/recordings/call_12345.mp3",
            "recording_checksum": "abcdef1234567890"
        }
    ]

    for event_payload in webhook_events:
        try:
            response = requests.post(
                f"{BASE_URL}{ENDPOINT}",
                json=event_payload,
                headers=headers,
                timeout=TIMEOUT
            )
            # Assert the response status code is 200 OK
            assert response.status_code == 200, f"Failed for event {event_payload['event']}, status code: {response.status_code}, response: {response.text}"
        except requests.RequestException as e:
            assert False, f"Request failed for event {event_payload['event']}: {str(e)}"


test_post_api_webhooks_vapi_webhook_processing()
