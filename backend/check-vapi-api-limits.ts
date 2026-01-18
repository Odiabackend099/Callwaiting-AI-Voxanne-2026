import axios from 'axios';
import { config } from './src/config/index';

async function checkVapiAssistant() {
  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';

  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    console.log('Fetching current assistant configuration from Vapi...\n');
    const response = await vapiClient.get(`/assistant/${assistantId}`);
    const assistant = response.data;

    console.log('Current Assistant Configuration:');
    console.log(JSON.stringify(assistant, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkVapiAssistant().catch(console.error);
