/**
 * Integration API Routes
 * GET /api/integrations/:provider - Fetch decrypted credentials for a provider
 * Returns 404 if unconfigured (no fallback data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

type IntegrationProvider = 'TWILIO' | 'GOOGLE' | 'VAPI' | 'OUTLOOK';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const provider = params.provider?.toUpperCase() as IntegrationProvider;

    // Validate provider
    const validProviders: IntegrationProvider[] = ['TWILIO', 'GOOGLE', 'VAPI', 'OUTLOOK'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${params.provider}` },
        { status: 400 }
      );
    }

    // Call backend service to fetch and decrypt credentials
    try {
      const config = await authedBackendFetch<any>(
        `/api/integrations/${provider}`,
        {
          method: 'GET',
          timeoutMs: 10000,
        }
      );

      // Ensure config is never empty/falsy
      if (!config || Object.keys(config).length === 0) {
        return NextResponse.json(
          { error: `${provider} not configured` },
          { status: 404 }
        );
      }

      return NextResponse.json({ config }, { status: 200 });
    } catch (backendError: any) {
      // If backend returns 404, propagate it
      if (backendError.status === 404) {
        return NextResponse.json(
          { error: `${provider} not configured` },
          { status: 404 }
        );
      }

      throw backendError;
    }
  } catch (error: any) {
    console.error('Integration API error:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to fetch integration' },
      { status: error?.status || 500 }
    );
  }
}
