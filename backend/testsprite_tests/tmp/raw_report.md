
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
  File "<string>", line 43, in test_receive_vapi_webhooks
AssertionError: Expected status code 200 for event call_started, got 400. Response text: {"error":"Invalid event structure"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/fb1fb0cc-8643-4893-8f39-ce77a01aa5d8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** test_start_outbound_calls
- **Test Code:** [TC002_test_start_outbound_calls.py](./TC002_test_start_outbound_calls.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 35, in <module>
  File "<string>", line 25, in test_start_outbound_calls
AssertionError: Unexpected status code: 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/7d6fd269-a1ed-4aa5-b4b7-88c02fba08c0
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** test_get_call_logs
- **Test Code:** [TC003_test_get_call_logs.py](./TC003_test_get_call_logs.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 49, in <module>
  File "<string>", line 40, in test_get_call_logs
AssertionError: 'pagination' missing field 'totalPages'

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/c31fdf15-ea47-4eae-90eb-dc3ca6dc0425
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** test_list_assistants
- **Test Code:** [TC004_test_list_assistants.py](./TC004_test_list_assistants.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/e3d492c9-1722-4faa-aae8-84d53163f579
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** test_create_assistant
- **Test Code:** [TC005_test_create_assistant.py](./TC005_test_create_assistant.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 30, in <module>
  File "<string>", line 21, in test_create_assistant
AssertionError: Unexpected status code 404: {"error":"Not found","path":"/api/assistants"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/ea2a0334-1911-4443-a634-37370561f9b7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** test_upload_knowledge_base_document
- **Test Code:** [TC006_test_upload_knowledge_base_document.py](./TC006_test_upload_knowledge_base_document.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 52, in <module>
  File "<string>", line 39, in test_upload_knowledge_base_document
AssertionError: Unexpected status code: 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/3ea02688-0606-4180-bdd3-6ea538a8ef49
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** test_query_knowledge_base
- **Test Code:** [TC007_test_query_knowledge_base.py](./TC007_test_query_knowledge_base.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 50, in <module>
  File "<string>", line 22, in test_query_knowledge_base
AssertionError: Unexpected status code: 404, Response Text: {"error":"Not found","path":"/api/knowledge-base/query"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/edd8b00d-711f-45d3-92f5-94892c9b1456
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** test_setup_vapi_integration
- **Test Code:** [TC008_test_setup_vapi_integration.py](./TC008_test_setup_vapi_integration.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 48, in <module>
  File "<string>", line 29, in test_setup_vapi_integration
AssertionError: Unexpected status code: 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/79cae656-6869-468d-aacb-914e02f010d4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** test_update_inbound_config
- **Test Code:** [TC009_test_update_inbound_config.py](./TC009_test_update_inbound_config.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 46, in <module>
  File "<string>", line 36, in test_update_inbound_config
AssertionError: Unexpected status code: 404

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/eb4d7719-9020-4e5a-bce0-a07c5a04099d
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010
- **Test Name:** test_get_founder_console_settings
- **Test Code:** [TC010_test_get_founder_console_settings.py](./TC010_test_get_founder_console_settings.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c72682a3-22de-4f04-a73c-39627f84ae34/d252b735-5095-4b95-b1b3-b5976cd16c56
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **20.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---