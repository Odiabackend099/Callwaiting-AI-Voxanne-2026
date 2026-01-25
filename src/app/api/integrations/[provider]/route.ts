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
    const backendUrl = `/api/integrations/${provider.toLowerCase()}`;
    console.log(`[NextAPI] Fetching integration config from: ${backendUrl}`);

    try {
      const config = await authedBackendFetch<any>(
        backendUrl,
        {
          method: 'GET',
          timeoutMs: 10000,
          // Don't throw on 404, handle it manually if the fetcher supports it, 
          // OR catch the error and inspect it.
          // Since our authedBackendFetch throws on !res.ok, we catch below.
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
      const status = backendError?.status || backendError?.response?.status || 500;
      const message = backendError?.message || 'Backend request failed';

      console.log(`[NextAPI] Backend returned status ${status} for ${provider}`);

      // Explicitly handle 404 (Not Configured) as a valid state, not an error
      if (status === 404) {
        return NextResponse.json(
          { error: `${provider} not configured` },
          { status: 404 }
        );
      }

      // Propagate other errors (401, 403, 500)
      return NextResponse.json(
        { error: message },
        { status: status }
      );
    }
  } catch (error: any) {
    console.error('Integration API Critical Fail:', error);
    return NextResponse.json(
      { error: 'Internal Proxy Error' },
      { status: 500 }
    );
  }
}
