import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * API Proxy for founder-console endpoints
 * 
 * This proxy forwards all requests to the backend, ensuring that:
 * 1. All HTTP requests appear to come from the same origin (localhost:3000)
 * 2. WebSocket URLs returned by the backend use localhost:3000 instead of localhost:3001
 * 3. Browser same-origin policy allows WebSocket connections
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pathSegments = params.path;
  const pathname = `/${pathSegments.join('/')}`;
  
  try {
    const body = await request.json().catch(() => ({}));
    
    const response = await fetch(`${BACKEND_URL}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // CRITICAL FIX: Rewrite WebSocket URL to use same origin as frontend
    if (data.bridgeWebsocketUrl && data.bridgeWebsocketUrl.includes('localhost:3001')) {
      data.bridgeWebsocketUrl = data.bridgeWebsocketUrl.replace(
        'ws://localhost:3001',
        'ws://localhost:3000'
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pathSegments = params.path;
  const pathname = `/${pathSegments.join('/')}`;
  const searchParams = request.nextUrl.search;

  try {
    const response = await fetch(`${BACKEND_URL}${pathname}${searchParams}`, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
