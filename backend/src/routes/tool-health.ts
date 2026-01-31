/**
 * Tool Chain Health Monitoring Endpoint
 *
 * GET /api/monitoring/tool-health
 *
 * Checks that all 5 Vapi tools are correctly registered and reachable
 * for each organization. Returns structured health report.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { resolveBackendUrl } from '../utils/resolve-backend-url';
import { log } from '../services/logger';
import axios from 'axios';

const router = Router();

const EXPECTED_TOOLS = [
  'checkAvailability',
  'bookClinicAppointment',
  'transferCall',
  'lookupCaller',
  'endCall'
];

interface ToolHealthResult {
  name: string;
  vapiToolId: string | null;
  registered: boolean;
  urlMatchesBackend: boolean;
  serverUrl: string | null;
}

interface OrgHealth {
  orgId: string;
  toolCount: number;
  expectedToolCount: number;
  tools: ToolHealthResult[];
  issues: string[];
}

router.get('/tool-health', async (_req: Request, res: Response) => {
  try {
    const backendUrl = resolveBackendUrl();
    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    const issues: string[] = [];

    // Check backend URL health
    if (backendUrl.includes('localhost')) {
      issues.push('BACKEND_URL resolves to localhost - Vapi cannot reach tools in production');
    }
    if (backendUrl.includes('ngrok')) {
      issues.push('BACKEND_URL uses ephemeral ngrok tunnel');
    }
    if (!vapiKey) {
      return res.json({
        status: 'unhealthy',
        resolvedBackendUrl: backendUrl,
        error: 'VAPI_PRIVATE_KEY not configured',
        orgs: []
      });
    }

    // Get all orgs with agents
    const { data: agents, error: agentsErr } = await supabase
      .from('agents')
      .select('id, org_id, role, vapi_assistant_id')
      .not('vapi_assistant_id', 'is', null);

    if (agentsErr) {
      return res.status(500).json({
        status: 'unhealthy',
        resolvedBackendUrl: backendUrl,
        error: `Database error: ${agentsErr.message}`,
        orgs: []
      });
    }

    const orgIds = Array.from(new Set((agents || []).map(a => a.org_id)));
    const orgResults: OrgHealth[] = [];

    for (const orgId of orgIds) {
      const orgIssues: string[] = [];

      // Query org_tools
      const { data: orgTools } = await supabase
        .from('org_tools')
        .select('tool_name, vapi_tool_id, definition_hash')
        .eq('org_id', orgId);

      const toolMap = new Map((orgTools || []).map(t => [t.tool_name, t]));
      const tools: ToolHealthResult[] = [];

      for (const expectedName of EXPECTED_TOOLS) {
        const registered = toolMap.get(expectedName);

        if (!registered) {
          tools.push({
            name: expectedName,
            vapiToolId: null,
            registered: false,
            urlMatchesBackend: false,
            serverUrl: null
          });
          orgIssues.push(`Tool "${expectedName}" not registered`);
          continue;
        }

        // Check Vapi tool exists and get its URL
        let serverUrl: string | null = null;
        let urlMatches = false;

        try {
          const vapiRes = await axios.get(
            `https://api.vapi.ai/tool/${registered.vapi_tool_id}`,
            {
              headers: { Authorization: `Bearer ${vapiKey}` },
              timeout: 5000
            }
          );

          serverUrl = vapiRes.data?.server?.url
            || vapiRes.data?.function?.server?.url
            || null;

          urlMatches = serverUrl ? serverUrl.startsWith(backendUrl) : false;

          if (!urlMatches && serverUrl) {
            orgIssues.push(
              `Tool "${expectedName}" URL mismatch: ${serverUrl} (expected prefix: ${backendUrl})`
            );
          }
        } catch (err: any) {
          if (err.response?.status === 404) {
            orgIssues.push(`Tool "${expectedName}" vapi_tool_id not found in Vapi`);
          } else {
            orgIssues.push(`Tool "${expectedName}" Vapi check failed: ${err.message}`);
          }
        }

        tools.push({
          name: expectedName,
          vapiToolId: registered.vapi_tool_id,
          registered: true,
          urlMatchesBackend: urlMatches,
          serverUrl
        });
      }

      // Check for old bug: all tools with same name
      const registeredNames = (orgTools || []).map(t => t.tool_name);
      if (registeredNames.length === 1 && registeredNames[0] === 'bookClinicAppointment') {
        orgIssues.push('Data corruption detected: all tools stored as "bookClinicAppointment" - run migration and re-sync');
      }

      orgResults.push({
        orgId,
        toolCount: (orgTools || []).length,
        expectedToolCount: EXPECTED_TOOLS.length,
        tools,
        issues: orgIssues
      });
    }

    // Determine overall status
    const allOrgIssues = orgResults.flatMap(o => o.issues);
    const hasCriticalIssues = allOrgIssues.some(i =>
      i.includes('not registered') || i.includes('URL mismatch') || i.includes('Data corruption')
    );

    const status = allOrgIssues.length === 0
      ? 'healthy'
      : hasCriticalIssues
        ? 'unhealthy'
        : 'degraded';

    res.json({
      status,
      resolvedBackendUrl: backendUrl,
      globalIssues: issues,
      orgCount: orgResults.length,
      orgs: orgResults
    });

  } catch (error: any) {
    log.error('ToolHealth', 'Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;
