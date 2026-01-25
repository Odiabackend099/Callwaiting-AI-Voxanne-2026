
import { VapiClient } from '../services/vapi-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY!;
const ASSISTANT_ID = 'f8926b7b-df79-4de5-8e81-a6bd9ad551f2';

async function check() {
    const vapi = new VapiClient(VAPI_PRIVATE_KEY);
    try {
        const assistant = await vapi.getAssistant(ASSISTANT_ID);
        console.log('Assistant Tool IDs:', assistant.model.toolIds);

        if (assistant.model.toolIds && assistant.model.toolIds.length > 0) {
            for (const toolId of assistant.model.toolIds) {
                try {
                    const tool = await vapi.getTool(toolId);
                    console.log(`Tool ${toolId}: ${tool.function?.name} -> ${tool.server?.url}`);
                } catch (e) {
                    console.log(`Tool ${toolId}: Could not fetch details`);
                }
            }
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

check();
