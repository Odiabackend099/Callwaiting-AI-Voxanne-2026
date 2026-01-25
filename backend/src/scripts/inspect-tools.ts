
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VAPI_API_KEY = (process.env.VAPI_PRIVATE_KEY || '').replace(/[\r\n\t\x00-\x1F\x7F]/g, '').replace(/^['"]|['"]$/g, '');
const TOOL_IDS = [
    '1a97a75c-f4f6-47b9-bee6-d78680d54278',
    'd7533793-1ad9-4d66-b91a-aeea1e791bec',
    '3aa4f1f2-0db5-4d1a-a76b-7c4ed95f58bf'
];

async function main() {
    console.log('🔍 Inspecting Tool IDs...\n');

    for (const id of TOOL_IDS) {
        try {
            const response = await axios.get(`https://api.vapi.ai/tool/${id}`, {
                headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
            });
            const tool = response.data;
            console.log(`🆔 ID: ${tool.id}`);
            console.log(`   Name: ${tool.function?.name}`);
            console.log(`   Type: ${tool.type}`);
            console.log(`   URL:  ${tool.server?.url}`);
            console.log('---------------------------------------------------');
        } catch (error: any) {
            console.log(`❌ Failed to fetch ${id}: ${error.message}`);
        }
    }
}

main();
