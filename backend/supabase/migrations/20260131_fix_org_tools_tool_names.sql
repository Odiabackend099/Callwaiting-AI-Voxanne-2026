-- Fix: org_tools data corruption from hardcoded tool_name
--
-- Bug: tool-sync-service.ts used 'bookClinicAppointment' as tool_name for ALL 5 tools.
-- The UNIQUE(org_id, tool_name) constraint caused each tool to overwrite the previous,
-- leaving only 1 row per org with the wrong vapi_tool_id.
--
-- This migration deletes corrupted rows so ToolSyncService can re-register
-- all 5 tools correctly on next agent save.

DELETE FROM org_tools WHERE tool_name = 'bookClinicAppointment';
