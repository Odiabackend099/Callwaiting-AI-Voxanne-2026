
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { VapiClient } from '../services/vapi-client';
import { ToolSyncService } from '../services/tool-sync-service';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const LOG_FILE = 'ngrok.log';
const BACKEND_PORT = 3001;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        exec(`lsof -i :${port}`, (error, stdout) => {
            resolve(stdout.length > 0);
        });
    });
}

async function getNgrokUrl(): Promise<string | null> {
    try {
        const response = await axios.get('http://localhost:4040/api/tunnels');
        const tunnel = response.data.tunnels.find((t: any) => t.proto === 'https');
        return tunnel ? tunnel.public_url : null;
    } catch (error) {
        return null;
    }
}

async function getNgrokUrlFromLog(logFile: string): Promise<string | null> {
    try {
        if (!fs.existsSync(logFile)) return null;
        const content = fs.readFileSync(logFile, 'utf8');
        const match = content.match(/url=(https:\/\/[^ ]+)/);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

async function main() {
    console.log('🚀 Starting Fix and Verify V2...');

    // 1. Start Backend (if not running)
    const isBackendRunning = await checkPort(BACKEND_PORT);
    if (!isBackendRunning) {
        console.log('Starting backend...');
        const backend = spawn('npm', ['run', 'dev'], {
            cwd: path.resolve(__dirname, '../../'),
            detached: true,
            stdio: 'ignore'
        });
        backend.unref();
        await sleep(5000); // Wait for backend to start
    } else {
        console.log('Backend already running.');
    }

    // 2. Start Ngrok (if not running)
    let ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
        console.log('Starting ngrok...');
        const ngrokLogPath = path.resolve(__dirname, '../../', LOG_FILE);
        const ngrok = spawn('ngrok', ['http', BACKEND_PORT.toString(), '--log=stdout'], {
            detached: true,
            stdio: ['ignore', fs.openSync(ngrokLogPath, 'w'), 'ignore']
        });
        ngrok.unref();

        // Wait for ngrok to generate URL
        console.log('Waiting for ngrok URL...');
        for (let i = 0; i < 10; i++) {
            await sleep(2000);
            ngrokUrl = await getNgrokUrlFromLog(ngrokLogPath);
            if (ngrokUrl) break;
            // Also try API in case it started
            if (!ngrokUrl) ngrokUrl = await getNgrokUrl();
            if (ngrokUrl) break;
        }
    }

    if (!ngrokUrl) {
        console.error('❌ Failed to get ngrok URL. Please start ngrok manually.');
        process.exit(1);
    }

    console.log(`✅ Ngrok URL: ${ngrokUrl}`);

    // 3. Register Tool
    console.log('Registering tool with new URL...');

    // Mock BACKEND_URL for ToolSyncService
    process.env.BACKEND_URL = ngrokUrl;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Fetch assistant ID
    const { data: agent } = await supabase
        .from('agents')
        .select('vapi_assistant_id')
        .eq('org_id', TARGET_ORG_ID)
        .eq('role', 'inbound')
        .single();

    if (!agent?.vapi_assistant_id) {
        throw new Error('Agent not found');
    }

    const assistantId = agent.vapi_assistant_id;
    console.log(`Assistant ID: ${assistantId}`);

    // Sync tools
    try {
        const result = await ToolSyncService.syncAllToolsForAssistant({
            orgId: TARGET_ORG_ID,
            assistantId: assistantId,
            backendUrl: ngrokUrl,
            skipIfExists: false
        });
        console.log('Tool Sync Result:', result);
    } catch (e: any) {
        console.error('Tool Sync Warning:', e.message);
        // Continue, as we might just need to link manually
    }

    // 4. Fix Linking (Manual Patch)
    const vapi = new VapiClient(VAPI_PRIVATE_KEY);
    const assistant = await vapi.getAssistant(assistantId);

    // Get the tool ID we just registered
    const { data: tools } = await supabase
        .from('org_tools')
        .select('vapi_tool_id')
        .eq('org_id', TARGET_ORG_ID)
        .eq('tool_name', 'bookClinicAppointment')
        .single();

    const toolId = tools?.vapi_tool_id;
    if (!toolId) throw new Error('Tool ID not found in DB');

    console.log(`Ensuring tool ${toolId} is linked to assistant...`);

    const currentToolIds = assistant.model.toolIds || [];
    if (!currentToolIds.includes(toolId)) {
        const newToolIds = [...currentToolIds, toolId];

        // Construct full update payload
        // We must be careful to include everything required by Vapi for 'model'
        const updatePayload = {
            model: {
                ...assistant.model,
                toolIds: newToolIds
            }
        };

        try {
            await vapi.updateAssistant(assistantId, updatePayload);
            console.log('✅ Assistant updated with new tool ID.');
        } catch (e: any) {
            console.error('❌ Failed to update assistant:', e.message);
            console.error('Payload:', JSON.stringify(updatePayload, null, 2));
            // Don't exit, try to run test anyway, maybe it worked partially or previous link is okay
        }
    } else {
        console.log('✅ Tool already linked.');
    }

    // 5. Run Contract Test
    console.log('Running contract test...');
    const testProcess = spawn('npx', ['ts-node', 'src/scripts/vapi-contract-test.ts'], {
        cwd: path.resolve(__dirname, '../../'),
        env: { ...process.env, BACKEND_URL: ngrokUrl },
        stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Contract Test PASSED');
        } else {
            console.error('❌ Contract Test FAILED');
        }
        process.exit(code || 0);
    });
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
