import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // In development, return a mock token
    // In production, this would validate the session and return a real JWT
    const token = 'dev-token-' + Date.now();
    
    return NextResponse.json({ 
      token,
      expiresIn: 3600 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get token' },
      { status: 500 }
    );
  }
}
