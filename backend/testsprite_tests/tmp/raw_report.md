
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** voxanne-backend
- **Date:** 2025-12-18
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** test_receive_vapi_webhooks
- **Test Code:** [TC001_test_receive_vapi_webhooks.py](./TC001_test_receive_vapi_webhooks.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 48, in <module>
  File "<string>", line 44, in test_receive_vapi_webhooks
AssertionError: Expected status 200 but got 400 for event call_started

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/11910fae-05c1-45d1-bf5b-512abdacf296
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** test_start_outbound_calls
- **Test Code:** [TC002_test_start_outbound_calls.py](./TC002_test_start_outbound_calls.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 41, in <module>
  File "<string>", line 27, in test_start_outbound_calls
AssertionError: Expected status code 200, got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/421b56a8-7433-45dd-ac0c-bdbde8d97797
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** test_get_call_logs
- **Test Code:** [TC003_test_get_call_logs.py](./TC003_test_get_call_logs.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 74, in <module>
  File "<string>", line 72, in run_test
  File "<string>", line 55, in test_get_call_logs
AssertionError: Expected key for 'direction' or 'escalationFlag' not found in call log item

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/bb090f2a-e748-495c-86cf-38bd5dea23e0
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** test_list_assistants
- **Test Code:** [TC004_test_list_assistants.py](./TC004_test_list_assistants.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 67, in <module>
  File "<string>", line 18, in test_list_assistants
AssertionError: Expected status code 200, got 500

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/fe5766b4-8b92-4a37-b1bc-aa4b313313ea
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** test_create_assistant
- **Test Code:** [TC005_test_create_assistant.py](./TC005_test_create_assistant.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 47, in <module>
  File "<string>", line 28, in test_create_assistant
AssertionError: Unexpected status code: 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/7e29736a-d590-4947-913d-d1fe293fc6ea
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** test_upload_knowledge_base_document
- **Test Code:** [TC006_test_upload_knowledge_base_document.py](./TC006_test_upload_knowledge_base_document.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 70, in <module>
  File "<string>", line 33, in test_upload_knowledge_base_document
AssertionError: Unexpected status code: 404 - {"error":"Not found","path":"/api/knowledge-base/upload"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/16a098cb-84fa-4ebb-ad00-bec27f6752c4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** test_query_knowledge_base
- **Test Code:** [TC007_test_query_knowledge_base.py](./TC007_test_query_knowledge_base.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 36, in <module>
  File "<string>", line 20, in test_query_knowledge_base
AssertionError: Expected status code 200 but got 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/f7b55d4d-fcdd-4044-9117-ce5e4786199f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** test_setup_vapi_integration
- **Test Code:** [TC008_test_setup_vapi_integration.py](./TC008_test_setup_vapi_integration.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 17, in test_setup_vapi_integration
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 404 Client Error: Not Found for url: http://localhost:3001/api/vapi/setup

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 24, in <module>
  File "<string>", line 19, in test_setup_vapi_integration
AssertionError: Request to setup Vapi integration failed: 404 Client Error: Not Found for url: http://localhost:3001/api/vapi/setup

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/dff5325f-02ea-4306-bf01-3a09faa7a7a1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** test_update_inbound_config
- **Test Code:** [TC009_test_update_inbound_config.py](./TC009_test_update_inbound_config.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 80, in <module>
  File "<string>", line 69, in test_update_inbound_config
AssertionError: Expected status code 200 but got 404. Response: {"error":"Not found","path":"/api/inbound/config"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/13c5265d-7aa2-43a7-a3aa-1e470138ecb8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010
- **Test Name:** test_get_founder_console_settings
- **Test Code:** [TC010_test_get_founder_console_settings.py](./TC010_test_get_founder_console_settings.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 51, in <module>
  File "<string>", line 48, in test_get_founder_console_settings
AssertionError: Feature 'inbound call handling' missing or disabled in settings response

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21998609-8612-4fa1-a25d-b046ea83b4bb/5917aabd-57be-43ee-829c-bebb2bbb3409
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **0.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---