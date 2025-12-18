
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** voxanne-backend
- **Date:** 2025-12-18
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** post api webhooks vapi webhook processing
- **Test Code:** [TC001_post_api_webhooks_vapi_webhook_processing.py](./TC001_post_api_webhooks_vapi_webhook_processing.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 67, in <module>
  File "<string>", line 62, in test_post_api_webhooks_vapi_webhook_processing
AssertionError: Failed for event call.started, status code: 400, response: {"error":"Invalid event structure"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/815f7a86-3645-499a-b0c2-9c0344e42a06
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** post api calls start outbound call initiation
- **Test Code:** [TC002_post_api_calls_start_outbound_call_initiation.py](./TC002_post_api_calls_start_outbound_call_initiation.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 30, in <module>
  File "<string>", line 22, in test_post_api_calls_start_outbound_call_initiation
AssertionError: Expected status code 200, got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/8e049077-7eca-4dc3-82c6-d848fa0a85d5
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** get api calls dashboard retrieve call logs
- **Test Code:** [TC003_get_api_calls_dashboard_retrieve_call_logs.py](./TC003_get_api_calls_dashboard_retrieve_call_logs.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 69, in <module>
  File "<string>", line 18, in test_get_calls_dashboard_retrieve_call_logs
AssertionError: Response JSON should be a list

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/b54a216d-1c9c-44f5-b70f-e251a92184c4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** get post api assistants manage ai assistants
- **Test Code:** [TC004_get_post_api_assistants_manage_ai_assistants.py](./TC004_get_post_api_assistants_manage_ai_assistants.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 40, in test_get_post_api_assistants_manage_ai_assistants
AssertionError: Expected status 200 or 201, got 404

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 66, in <module>
  File "<string>", line 49, in test_get_post_api_assistants_manage_ai_assistants
AssertionError: POST /api/assistants request failed: Expected status 200 or 201, got 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/ac498511-67b6-40d5-9196-2438782195f4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** post api knowledge base upload document
- **Test Code:** [TC005_post_api_knowledge_base_upload_document.py](./TC005_post_api_knowledge_base_upload_document.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 39, in <module>
  File "<string>", line 22, in test_post_api_knowledge_base_upload_document
AssertionError: Expected status code 200, got 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/c3d3b9f6-34c8-4a76-bb60-bc1d11fae4eb
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** post api knowledge base query knowledge base
- **Test Code:** [TC006_post_api_knowledge_base_query_knowledge_base.py](./TC006_post_api_knowledge_base_query_knowledge_base.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 17, in test_post_api_knowledge_base_query_knowledge_base
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 404 Client Error: Not Found for url: http://localhost:3001/api/knowledge-base/query

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 41, in <module>
  File "<string>", line 19, in test_post_api_knowledge_base_query_knowledge_base
AssertionError: Request failed: 404 Client Error: Not Found for url: http://localhost:3001/api/knowledge-base/query

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/3b13de39-809a-4f8e-9ef4-6b1744b9eaec
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** post api vapi setup integration setup
- **Test Code:** [TC007_post_api_vapi_setup_integration_setup.py](./TC007_post_api_vapi_setup_integration_setup.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 54, in <module>
  File "<string>", line 30, in test_post_api_vapi_setup_integration_setup
AssertionError: Expected status code 200 or 201, got 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/b1f6cd82-567c-4e3f-83e6-01331f272c86
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** post api inbound config update inbound call handling
- **Test Code:** [TC008_post_api_inbound_config_update_inbound_call_handling.py](./TC008_post_api_inbound_config_update_inbound_call_handling.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 28, in test_post_api_inbound_config_update_inbound_call_handling
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 404 Client Error: Not Found for url: http://localhost:3001/api/inbound/config

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 47, in <module>
  File "<string>", line 30, in test_post_api_inbound_config_update_inbound_call_handling
AssertionError: POST /api/inbound/config request failed: 404 Client Error: Not Found for url: http://localhost:3001/api/inbound/config

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/0436612a-1704-414c-a5f8-5fb95e4ae88f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** get api founder console settings retrieve settings
- **Test Code:** [TC009_get_api_founder_console_settings_retrieve_settings.py](./TC009_get_api_founder_console_settings_retrieve_settings.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/4774b9ff-79be-4cda-ab88-be6daa6d9da5/4e12e1af-62c4-4565-827d-887bad821b7c
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **11.11** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---