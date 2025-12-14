#!/usr/bin/env node
// ============================================================================
// AGENT SCRIPT: Update Vapi Assistant to Use High-Quality Voice Provider
// Location: backend/.claude/agents/terminal/scripts/fix-vapi-voice.js
// ============================================================================

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVapiVoice() {
  console.log('🎙️  Fixing Vapi Assistant Voice Quality...\n');

  try {
    // Get Vapi credentials from database
    const vapiIntegration = await prisma.integrations.findFirst({
      where: { provider: 'vapi' },
      select: { api_key: true }
    });

    if (!vapiIntegration?.api_key) {
      console.error('❌ Vapi API key not found in database');
      process.exit(1);
    }

    const assistant = await prisma.voice_assistants.findFirst({
      where: { provider: 'vapi' },
      select: { vapi_assistant_id: true, name: true }
    });

    if (!assistant?.vapi_assistant_id) {
      console.error('❌ Vapi assistant not found in database');
      process.exit(1);
    }

    console.log(`📋 Current Assistant: ${assistant.name} (${assistant.vapi_assistant_id})\n`);

    // Fetch current configuration
    const currentConfig = await axios.get(
      `https://api.vapi.ai/assistant/${assistant.vapi_assistant_id}`,
      {
        headers: { 'Authorization': `Bearer ${vapiIntegration.api_key}` }
      }
    );

    console.log('🔍 Current Voice Configuration:');
    console.log(`   Provider: ${currentConfig.data.voice?.provider || 'NOT SET'}`);
    console.log(`   Voice ID: ${currentConfig.data.voice?.voiceId || 'NOT SET'}\n`);

    // ========================================================================
    // FIX: Use ElevenLabs Kylie (highest quality, natural voice)
    // ========================================================================
    const newVoiceConfig = {
      ...currentConfig.data,
      voice: {
        provider: '11labs',          // ElevenLabs (premium quality)
        voiceId: 'Kylie',            // Natural, clear female voice
        stability: 0.5,              // Balanced stability
        similarity: 0.75             // High similarity to original
      }
    };

    console.log('✨ Updating to ElevenLabs Kylie voice...');
    console.log(`   Provider: ${newVoiceConfig.voice.provider}`);
    console.log(`   Voice: ${newVoiceConfig.voice.voiceId}`);
    console.log(`   Stability: ${newVoiceConfig.voice.stability}`);
    console.log(`   Similarity: ${newVoiceConfig.voice.similarity}\n`);

    // Update assistant
    const response = await axios.patch(
      `https://api.vapi.ai/assistant/${assistant.vapi_assistant_id}`,
      newVoiceConfig,
      {
        headers: {
          'Authorization': `Bearer ${vapiIntegration.api_key}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Voice configuration updated successfully!\n');

    console.log('📝 Next Steps:');
    console.log('   1. Restart your Web Test in the browser');
    console.log('   2. The new voice should sound much clearer');
    console.log('   3. If you want to try other voices, edit this script and re-run\n');

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
  } finally {
    await prisma.$disconnect();
  }
}

fixVapiVoice();
