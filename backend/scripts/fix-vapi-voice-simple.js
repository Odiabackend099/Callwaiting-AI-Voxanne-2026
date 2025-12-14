#!/usr/bin/env node
// ============================================================================
// SCRIPT: Update Vapi Assistant to Use High-Quality Voice Provider (Kylie)
// ============================================================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function fixVapiVoice() {
  console.log('🎙️  Fixing Vapi Assistant Voice Quality...\n');

  try {
    const vapiApiKey = process.env.VAPI_API_KEY;
    
    if (!vapiApiKey) {
      console.error('❌ VAPI_API_KEY not found in .env file');
      process.exit(1);
    }

    console.log('📋 Fetching Vapi assistants...\n');

    // Get all assistants
    const assistantsResponse = await axios.get(
      'https://api.vapi.ai/assistant',
      {
        headers: { 'Authorization': `Bearer ${vapiApiKey}` }
      }
    );

    const assistants = assistantsResponse.data.assistants || [];
    
    if (assistants.length === 0) {
      console.error('❌ No Vapi assistants found');
      process.exit(1);
    }

    console.log(`Found ${assistants.length} assistant(s):\n`);
    
    // Update each assistant
    for (const assistant of assistants) {
      console.log(`📋 Assistant: ${assistant.name} (${assistant.id})`);
      
      console.log(`   Current Voice: ${assistant.voice?.provider || 'NOT SET'} / ${assistant.voice?.voiceId || 'NOT SET'}`);

      // ========================================================================
      // FIX: Use ElevenLabs Kylie (highest quality, natural voice)
      // ========================================================================
      const updatedConfig = {
        ...assistant,
        voice: {
          provider: '11labs',          // ElevenLabs (premium quality)
          voiceId: 'Kylie',            // Natural, clear female voice
          stability: 0.5,              // Balanced stability
          similarity: 0.75             // High similarity to original
        }
      };

      console.log(`   ✨ Updating to: 11labs / Kylie\n`);

      // Update assistant
      await axios.patch(
        `https://api.vapi.ai/assistant/${assistant.id}`,
        updatedConfig,
        {
          headers: {
            'Authorization': `Bearer ${vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`   ✅ Updated successfully!\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Next Steps:');
    console.log('   1. Refresh your Web Test in the browser');
    console.log('   2. Click "Start Test" again');
    console.log('   3. The new voice should sound much clearer\n');

    console.log('📚 Alternative Voices Available:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ElevenLabs (Premium, highest quality):');
    console.log('     voiceId: "Rachel", "Bella", "Aria", "Kylie"');
    console.log('   PlayHT (Good quality, fast):');
    console.log('     provider: "playht", voiceId: "jennifer"');
    console.log('   Azure (Reliable, moderate quality):');
    console.log('     provider: "azure", voiceId: "en-US-JennyNeural"');
    console.log('   Deepgram Aura (Fast, clear):');
    console.log('     provider: "deepgram", voiceId: "aura-asteria-en"\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

fixVapiVoice();
