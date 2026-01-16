#!/usr/bin/env ts-node
/**
 * Direct Vapi Assistant Creator
 * 
 * Creates a single assistant directly via Vapi API
 * and outputs the ID for use in calls.
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function createAssistantDirect() {
  const vapiApiKey = process.env.VAPI_API_KEY;

  if (!vapiApiKey) {
    console.error('❌ VAPI_API_KEY not set');
    process.exit(1);
  }

  try {
    console.log('[CREATE-ASSISTANT] Starting direct Vapi assistant creation...');

    const payload = {
      name: 'Voxanne Lead Qualifier',
      model: {
        provider: 'openai',
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional lead qualification assistant for Wellness Partners. Your role is to:
1. Greet the prospect warmly
2. Qualify their interest in scheduling appointments
3. Gather key information (name, clinic type, availability)
4. Confirm next steps
5. End the call professionally

Be conversational, empathetic, and efficient. Keep calls under 5 minutes.`
          }
        ]
      },
      voice: {
        provider: 'deepgram',
        voiceId: 'asteria'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      firstMessage:
        "Hi! Thanks for taking my call. I'm calling from Wellness Partners. Do you have a quick minute to chat about scheduling appointments?"
    };

    const response = await axios.post('https://api.vapi.ai/assistant', payload, {
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const assistantId = response.data.id;

    console.log(`\n✅ Assistant created successfully!\n`);
    console.log(`Assistant ID: ${assistantId}`);
    console.log(`Assistant Name: ${response.data.name}`);
    console.log(`\nUse this ID in Supabase:\n`);
    console.log(`update agents set vapi_assistant_id = '${assistantId}' where role = 'outbound';\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to create assistant');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Full response:', error.response?.data);
    process.exit(1);
  }
}

createAssistantDirect();
