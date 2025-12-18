import requests

BASE_URL = "http://localhost:3001"
CALLS_DASHBOARD_ENDPOINT = f"{BASE_URL}/api/calls-dashboard"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json",
}

def test_get_calls_dashboard_retrieve_call_logs():
    from datetime import datetime
    try:
        # 1. Basic retrieval without filters
        response = requests.get(CALLS_DASHBOARD_ENDPOINT, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()

        assert isinstance(data, list), "Response JSON should be a list"

        logs = data
        assert all(isinstance(call, dict) for call in logs), "All call logs entries should be dicts"

        # 2. Test pagination if available - try passing common pagination query params
        pagination_params = {
            "page": 1,
            "pageSize": 10
        }
        response_pag = requests.get(CALLS_DASHBOARD_ENDPOINT, headers=HEADERS, params=pagination_params, timeout=TIMEOUT)
        response_pag.raise_for_status()
        data_pag = response_pag.json()
        assert isinstance(data_pag, list), "Paginated response JSON should be a list"
        logs_pag = data_pag
        assert all(isinstance(call, dict) for call in logs_pag), "All paginated call logs entries should be dicts"

        # 3. Test filtering (assuming typical filter e.g. by date range or call status)
        filter_params = {
            "startDate": "2024-01-01T00:00:00Z",
            "endDate": "2024-12-31T23:59:59Z",
            "callStatus": "completed"
        }
        response_filter = requests.get(CALLS_DASHBOARD_ENDPOINT, headers=HEADERS, params=filter_params, timeout=TIMEOUT)
        response_filter.raise_for_status()
        data_filter = response_filter.json()

        assert isinstance(data_filter, list), "Filtered response JSON should be a list"
        logs_filter = data_filter

        # If logs exist, check the filtered criteria
        if logs_filter:
            for call in logs_filter:
                # Validate expected keys exist
                assert "status" in call, "Call log entry missing 'status'"
                assert call["status"] == "completed", "Call log does not meet filter status"
                assert "startTime" in call, "Call log entry missing 'startTime'"
                # Validate date range logic assuming ISO8601 strings
                start_date = datetime.fromisoformat(filter_params["startDate"].replace("Z", "+00:00"))
                end_date = datetime.fromisoformat(filter_params["endDate"].replace("Z", "+00:00"))
                call_start = datetime.fromisoformat(call["startTime"].replace("Z", "+00:00"))
                assert start_date <= call_start <= end_date, "Call startTime not in filtered date range"

        # 4. Validate analytics data presence (assuming analytics may appear in a dedicated key)
        # Since response is a list, no analytics expected at top level. Skipping analytics check on this endpoint.

    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"
    except ValueError:
        assert False, "Response content is not valid JSON"

test_get_calls_dashboard_retrieve_call_logs()
