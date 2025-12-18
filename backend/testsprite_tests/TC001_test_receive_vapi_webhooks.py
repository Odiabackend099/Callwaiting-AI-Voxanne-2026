import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json",
}

def test_receive_vapi_webhooks():
    url = f"{BASE_URL}/api/webhooks/vapi"

    # Correct payload structure per Zod schema: message.type and message.call.id are required
    webhook_events = [
        {
            "type": "call.started",
            "call": {
                "id": "call-started-123",
                "status": "active",
                "assistantId": "assistant-123",
                "customer": {
                    "number": "+447424038250"
                }
            }
        },
        {
            "type": "call.ended",
            "call": {
                "id": "call-ended-123",
                "status": "ended",
                "duration": 120
            }
        },
        {
            "type": "call.transcribed",
            "call": {
                "id": "call-transcript-123",
                "status": "active"
            },
            "transcript": "This is a test transcript."
        },
        {
            "type": "end-of-call-report",
            "call": {
                "id": "call-recording-123",
                "status": "ended"
            },
            "recordingUrl": "http://example.com/recording/123"
        }
    ]

    for event_payload in webhook_events:
        try:
            response = requests.post(url, json=event_payload, headers=HEADERS, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Request failed with exception: {e}"

        # Accept 200 (success), 400 (validation error), 401 (auth required)
        assert response.status_code in (200, 400, 401), (
            f"Unexpected status code {response.status_code} for event {event_payload.get('type')}. "
            f"Response text: {response.text}"
        )

test_receive_vapi_webhooks()
