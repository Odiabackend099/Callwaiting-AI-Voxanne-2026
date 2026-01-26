/**
 * Test Fixtures & Mock Setup
 *
 * Provides reusable mocking utilities for all E2E tests
 */

import { Page } from '@playwright/test';

/**
 * Mock API Response with call data
 */
export const mockCallsResponse = {
  calls: [
    {
      id: 'call-1',
      phone_number: '+12025551234',
      caller_name: 'John Doe',
      call_date: new Date().toISOString(),
      duration_seconds: 120,
      status: 'completed',
      has_recording: true,
      recording_status: 'completed',
      recording_url: 'https://example.com/recording.mp3',
      has_transcript: true,
      sentiment_label: 'neutral',
      sentiment_score: 0.5,
      sentiment_summary: 'Caller inquired about service details',
      sentiment_urgency: 'Low',
      call_type: 'inbound',
      transcript: [
        {
          speaker: 'caller',
          text: 'Hi, I wanted to ask about your services',
          timestamp: Date.now(),
          sentiment: 'neutral'
        },
        {
          speaker: 'voxanne',
          text: 'Hello! I would be happy to help you with any questions',
          timestamp: Date.now() + 1000,
          sentiment: 'positive'
        }
      ],
      action_items: ['Follow up with caller', 'Send pricing information']
    }
  ],
  pagination: {
    total: 1,
    page: 1,
    limit: 100
  }
};

/**
 * Setup authentication and API mocking
 */
export async function setupTestEnvironment(page: Page) {
  // Mock Supabase session in localStorage
  // This allows the AuthContext to initialize properly
  const mockSession = {
    access_token: 'pk.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJlbWFpbF9jb25maXJtZWRfYXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiIsImFwcF9tZXRhZGF0YSI6eyJvcmdfaWQiOiIxMjM0NTY3OC1hYmNkLWVmMDEtMjM0NS02Nzg5YWJjZGVmMDEifX0.mock-signature',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    type: 'authenticated',
    user: {
      id: '00000000-0000-0000-0000-000000000000',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      email_confirmed_at: '2024-01-01T00:00:00Z',
      phone: '',
      confirmation_sent_at: null,
      confirmed_at: '2024-01-01T00:00:00Z',
      last_sign_in_at: '2024-01-01T00:00:00Z',
      app_metadata: {
        provider: 'email',
        org_id: '12345678-abcd-ef01-2345-6789abcdef01'
      },
      user_metadata: {
        name: 'Test User'
      },
      identities: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  };

  // Set the session in localStorage (Supabase auth-helpers stores it here)
  await page.addInitScript((sessionData) => {
    // Get Supabase project ID from environment
    const projectId = (window as any).NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].replace('https://', '') || 'test-project';
    const sessionKey = `sb-${projectId}-auth-token`;
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
  }, mockSession);

  // Mock Supabase auth endpoints
  await page.route('**/auth/v1/session**', async (route) => {
    // Return mock session for auth calls
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: mockSession.access_token,
        refresh_token: mockSession.refresh_token,
        expires_in: mockSession.expires_in,
        token_type: mockSession.token_type,
        type: mockSession.type,
        user: mockSession.user
      })
    });
  });

  // Mock all API calls
  await page.route('**/api/calls-dashboard**', async (route) => {
    const url = route.request().url();

    // Handle specific API endpoints
    if (url.includes('/api/calls-dashboard?')) {
      // Calls list endpoint
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCallsResponse)
      });
    } else if (url.includes('/api/calls-dashboard/call-1')) {
      // Call detail endpoint
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCallsResponse.calls[0])
      });
    } else if (url.includes('/api/calls-dashboard/') && url.includes('/followup')) {
      // SMS followup endpoint
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'SMS sent' })
      });
    } else if (url.includes('/api/calls-dashboard/') && url.includes('/share')) {
      // Share recording endpoint
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          shareUrl: 'https://example.com/share/abc123'
        })
      });
    } else if (url.includes('/api/calls-dashboard/') && url.includes('/transcript/export')) {
      // Transcript export endpoint
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Transcript content here'
      });
    } else {
      await route.continue();
    }
  });

  // Mock analytics endpoint
  await page.route('**/api/calls-dashboard/analytics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_calls: 1,
        completed: 1,
        missed: 0,
        average_duration: 120
      })
    });
  });

  // Mock CSRF token endpoint
  await page.route('**/api/csrf-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-csrf-token-1234567890'
      })
    });
  });

  // Mock health check
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' })
    });
  });

  // Default catch-all for other API routes
  await page.route('**/api/**', async (route) => {
    console.log('Unhandled API route:', route.request().url());
    await route.continue();
  });
}

/**
 * Mock processing state recording
 */
export async function mockProcessingRecording(page: Page) {
  await page.route('**/api/calls-dashboard?**', async (route) => {
    const response = JSON.parse(JSON.stringify(mockCallsResponse));
    response.calls[0].recording_status = 'processing';
    response.calls[0].recording_url = null;
    await route.fulfill({
      status: 200,
      body: JSON.stringify(response)
    });
  });
}

/**
 * Mock failed state recording
 */
export async function mockFailedRecording(page: Page) {
  await page.route('**/api/calls-dashboard?**', async (route) => {
    const response = JSON.parse(JSON.stringify(mockCallsResponse));
    response.calls[0].recording_status = 'failed';
    response.calls[0].recording_error = 'Storage upload failed';
    response.calls[0].recording_url = null;
    await route.fulfill({
      status: 200,
      body: JSON.stringify(response)
    });
  });
}

/**
 * Mock no transcript
 */
export async function mockNoTranscript(page: Page) {
  await page.route('**/api/calls-dashboard?**', async (route) => {
    const response = JSON.parse(JSON.stringify(mockCallsResponse));
    response.calls[0].has_transcript = false;
    response.calls[0].transcript = [];
    await route.fulfill({
      status: 200,
      body: JSON.stringify(response)
    });
  });
}

/**
 * Mock no phone number
 */
export async function mockNoPhoneNumber(page: Page) {
  await page.route('**/api/calls-dashboard?**', async (route) => {
    const response = JSON.parse(JSON.stringify(mockCallsResponse));
    response.calls[0].phone_number = null;
    await route.fulfill({
      status: 200,
      body: JSON.stringify(response)
    });
  });
}

/**
 * Wait for page to be interactive
 */
export async function waitForPageReady(page: Page) {
  // Wait for the page to finish loading
  await page.waitForLoadState('networkidle');

  // Wait for buttons to appear (ensures React has mounted and rendered)
  await page.waitForSelector('button', { timeout: 10000 }).catch(() => {
    // If no buttons found, page might still be initializing
    console.warn('No buttons found after 10 seconds, continuing anyway');
  });

  // Additional wait to ensure any auth redirects are resolved
  await page.waitForTimeout(1000);
}
