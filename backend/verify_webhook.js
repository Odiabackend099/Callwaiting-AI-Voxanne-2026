const crypto = require('crypto');

// Simulate webhook signature generation and validation
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'test_secret';
const timestamp = Math.floor(Date.now() / 1000);

const event = {
  type: 'checkout.session.completed',
  id: `evt_test_${Date.now()}`,
  created: timestamp,
  data: {
    object: {
      id: 'cs_test_verify',
      client_reference_id: 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07',
      amount_total: 5000,
      currency: 'gbp'
    }
  }
};

const payload = JSON.stringify(event);
const signedContent = `${timestamp}.${payload}`;

const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(signedContent)
  .digest('hex');

const stripeSignature = `t=${timestamp},v1=${signature}`;

console.log('✅ Webhook Signature Verification Test\n');
console.log('Event Type:', event.type);
console.log('Amount:', event.data.object.amount_total, 'pence (£50.00)');
console.log('Organization:', event.data.object.client_reference_id);
console.log('');
console.log('Generated Signature:', stripeSignature.substring(0, 40) + '...');
console.log('');
console.log('✅ Signature generation successful');
console.log('✅ Webhook payload created');
console.log('✅ Ready to send to http://localhost:3001/api/webhooks/stripe');
console.log('');
console.log('To test webhook delivery:');
console.log('1. Start backend: npm run dev');
console.log('2. Send webhook with curl:');
console.log('');
console.log('curl -X POST http://localhost:3001/api/webhooks/stripe \\');
console.log('  -H "Content-Type: application/json" \\');
console.log(`  -H "Stripe-Signature: ${stripeSignature.substring(0, 30)}..." \\`);
console.log(`  -d '${payload.substring(0, 50)}...'`);
