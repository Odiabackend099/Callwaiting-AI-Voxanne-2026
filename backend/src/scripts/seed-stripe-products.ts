/**
 * Stripe Product Seed Script
 *
 * Idempotently creates Voxanne billing products, prices, and meters in Stripe.
 * Run manually: npx tsx src/scripts/seed-stripe-products.ts
 *
 * All amounts are in pence (GBP). Metered overage uses sum aggregation.
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia' as any,
  typescript: true,
});

interface TierConfig {
  name: string;
  tier: string;
  monthlyPence: number;
  overagePencePerMin: number;
  setupPence: number;
  includedMinutes: number;
}

const TIERS: TierConfig[] = [
  {
    name: 'Voxanne Starter',
    tier: 'starter',
    monthlyPence: 35000,        // £350
    overagePencePerMin: 45,     // £0.45
    setupPence: 100000,         // £1,000
    includedMinutes: 400,
  },
  {
    name: 'Voxanne Professional',
    tier: 'professional',
    monthlyPence: 55000,        // £550
    overagePencePerMin: 40,     // £0.40
    setupPence: 300000,         // £3,000
    includedMinutes: 1200,
  },
  {
    name: 'Voxanne Enterprise',
    tier: 'enterprise',
    monthlyPence: 80000,        // £800
    overagePencePerMin: 35,     // £0.35
    setupPence: 700000,         // £7,000
    includedMinutes: 2000,
  },
];

async function findProductByMetadata(tier: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ limit: 100 });
  return products.data.find(p => p.metadata?.voxanne_tier === tier) || null;
}

async function findSetupProductByMetadata(tier: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ limit: 100 });
  return products.data.find(p => p.metadata?.voxanne_setup_tier === tier) || null;
}

async function findPriceByMetadata(
  productId: string,
  priceType: string
): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({ product: productId, limit: 100 });
  return prices.data.find(p => p.metadata?.voxanne_price_type === priceType) || null;
}

async function seedTier(config: TierConfig): Promise<{
  productId: string;
  recurringPriceId: string;
  overagePriceId: string;
  setupProductId: string;
  setupPriceId: string;
}> {
  console.log(`\n--- Seeding tier: ${config.name} ---`);

  // 1. Find or create subscription product
  let product = await findProductByMetadata(config.tier);
  if (product) {
    console.log(`  Product exists: ${product.id} (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: config.name,
      description: `${config.name} - ${config.includedMinutes} minutes/month included`,
      metadata: {
        voxanne_tier: config.tier,
        included_minutes: String(config.includedMinutes),
      },
    });
    console.log(`  Product created: ${product.id}`);
  }

  // 2. Find or create recurring monthly price
  let recurringPrice = await findPriceByMetadata(product.id, `${config.tier}_monthly`);
  if (recurringPrice) {
    console.log(`  Recurring price exists: ${recurringPrice.id} (${recurringPrice.unit_amount} pence/mo)`);
  } else {
    recurringPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: config.monthlyPence,
      currency: 'gbp',
      recurring: {
        interval: 'month',
      },
      metadata: {
        voxanne_price_type: `${config.tier}_monthly`,
      },
    });
    console.log(`  Recurring price created: ${recurringPrice.id} (${config.monthlyPence} pence/mo)`);
  }

  // 3. Find or create metered overage price
  let overagePrice = await findPriceByMetadata(product.id, `${config.tier}_overage`);
  if (overagePrice) {
    console.log(`  Overage price exists: ${overagePrice.id} (${overagePrice.unit_amount} pence/min)`);
  } else {
    overagePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: config.overagePencePerMin,
      currency: 'gbp',
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum',
      },
      metadata: {
        voxanne_price_type: `${config.tier}_overage`,
      },
    });
    console.log(`  Overage price created: ${overagePrice.id} (${config.overagePencePerMin} pence/min)`);
  }

  // 4. Find or create setup fee product
  let setupProduct = await findSetupProductByMetadata(config.tier);
  if (setupProduct) {
    console.log(`  Setup product exists: ${setupProduct.id}`);
  } else {
    setupProduct = await stripe.products.create({
      name: `${config.name} - Setup Fee`,
      description: `One-time onboarding and configuration for ${config.name}`,
      metadata: {
        voxanne_setup_tier: config.tier,
      },
    });
    console.log(`  Setup product created: ${setupProduct.id}`);
  }

  // 5. Find or create setup fee price
  let setupPrice = await findPriceByMetadata(setupProduct.id, `${config.tier}_setup`);
  if (setupPrice) {
    console.log(`  Setup price exists: ${setupPrice.id} (${setupPrice.unit_amount} pence)`);
  } else {
    setupPrice = await stripe.prices.create({
      product: setupProduct.id,
      unit_amount: config.setupPence,
      currency: 'gbp',
      metadata: {
        voxanne_price_type: `${config.tier}_setup`,
      },
    });
    console.log(`  Setup price created: ${setupPrice.id} (${config.setupPence} pence)`);
  }

  return {
    productId: product.id,
    recurringPriceId: recurringPrice.id,
    overagePriceId: overagePrice.id,
    setupProductId: setupProduct.id,
    setupPriceId: setupPrice.id,
  };
}

async function main() {
  console.log('=== Voxanne Stripe Product Seeding ===');
  console.log(`Using Stripe key: ${STRIPE_SECRET_KEY!.substring(0, 12)}...`);

  const results: Record<string, any> = {};

  for (const tier of TIERS) {
    results[tier.tier] = await seedTier(tier);
  }

  console.log('\n=== Seeding Complete ===\n');
  console.log('Add these to your .env file:\n');

  for (const tier of TIERS) {
    const r = results[tier.tier];
    const upper = tier.tier.toUpperCase();
    console.log(`STRIPE_${upper}_PRICE_ID=${r.recurringPriceId}`);
    console.log(`STRIPE_${upper}_OVERAGE_PRICE_ID=${r.overagePriceId}`);
    console.log(`STRIPE_${upper}_SETUP_PRICE_ID=${r.setupPriceId}`);
  }

  console.log('\n--- Product IDs (for reference) ---');
  for (const tier of TIERS) {
    const r = results[tier.tier];
    console.log(`${tier.tier}: product=${r.productId}, setup_product=${r.setupProductId}`);
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
