/**
 * Stripe Webhook Endpoint Setup Script
 * 
 * Automatically registers webhook endpoint with Stripe API
 * Detects existing endpoints and creates if needed
 * Stores webhook signing secret for validation
 */

import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';
import { getWebhookUrlForEnvironment, WEBHOOK_EVENTS, STRIPE_WEBHOOK_CONFIG } from '../config/stripe-webhook-config';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

async function ensureWebhookEndpoint(): Promise<void> {
  console.log('🔧 Setting up Stripe Webhook Endpoint...\n');
  
  const webhookUrl = getWebhookUrlForEnvironment();
  const existingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Webhook URL: ${webhookUrl}\n`);
  
  try {
    // List existing webhook endpoints
    console.log('🔍 Checking for existing webhook endpoints...');
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    
    // Find endpoint for current URL
    const existingEndpoint = endpoints.data.find(ep => ep.url === webhookUrl);
    
    if (existingEndpoint && existingSecret) {
      console.log('✅ Webhook endpoint already configured');
      console.log(`   ID: ${existingEndpoint.id}`);
      console.log(`   URL: ${existingEndpoint.url}`);
      console.log(`   Events: ${existingEndpoint.enabled_events.length}`);
      return;
    }
    
    if (existingEndpoint && !existingSecret) {
      console.log('⚠️  Endpoint exists but webhook secret not in environment');
      console.log('   Please add STRIPE_WEBHOOK_SECRET to .env');
      return;
    }
    
    // Create new endpoint
    console.log('\n🚀 Creating new webhook endpoint...');
    const newEndpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS as any
    });
    
    console.log('✅ Webhook endpoint created!');
    console.log(`   ID: ${newEndpoint.id}`);
    console.log(`   URL: ${newEndpoint.url}`);
    console.log(`   Status: ${newEndpoint.status}`);
    console.log(`   Events: ${newEndpoint.enabled_events.length}\n`);
    
    // Store webhook secret
    console.log('🔐 Storing webhook secret...');
    await storeWebhookSecret(newEndpoint.secret);
    
    console.log('✅ Webhook setup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Backend will automatically use the webhook secret');
    console.log('   2. Stripe will send webhook events to your endpoint');
    console.log('   3. Run: npm run dev (or restart server)');
    
  } catch (error: any) {
    console.error('❌ Failed to setup webhook endpoint');
    console.error(`Error: ${error.message}`);
    
    // Don't exit on error - app can still run without automated setup
    console.log('\n⚠️  Webhook setup failed, but app can run with manual configuration');
  }
}

async function storeWebhookSecret(secret: string): Promise<void> {
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    let envContent = '';
    
    // Read existing .env if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Remove existing STRIPE_WEBHOOK_SECRET line if present
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('STRIPE_WEBHOOK_SECRET='))
      .join('\n');
    
    // Add new secret
    const newLine = `\nSTRIPE_WEBHOOK_SECRET='${secret}'\n`;
    envContent += newLine;
    
    // Write back to .env
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
    
    console.log('   ✅ Added STRIPE_WEBHOOK_SECRET to .env');
    console.log(`   Secret: whsec_${secret.substring(6, 20)}...`);
    
    // Also set in current process
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    
  } catch (error: any) {
    console.warn('⚠️  Could not write to .env file');
    console.warn(`   Error: ${error.message}`);
    console.warn('   You can manually add: STRIPE_WEBHOOK_SECRET=' + secret);
  }
}

// Run if executed directly
if (require.main === module) {
  ensureWebhookEndpoint().catch(console.error);
}

export { ensureWebhookEndpoint };
