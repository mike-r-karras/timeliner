import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import crypto from 'crypto';

// Simple API key storage (in production, store this in database)
const API_KEYS = new Map<string, { userId: string, expiresAt: number }>();

// Generate a temporary API key (valid for 24 hours)
export async function GET(request: NextRequest) {
  try {
    // Check if request has valid session cookie
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    API_KEYS.set(apiKey, {
      userId: session.user.id,
      expiresAt
    });

    return NextResponse.json({
      apiKey,
      expiresAt: new Date(expiresAt).toISOString(),
      message: 'Use this key in Authorization header: Bearer YOUR_KEY'
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Verify API key and return user info
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer '
    const keyData = API_KEYS.get(apiKey);

    if (!keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (Date.now() > keyData.expiresAt) {
      API_KEYS.delete(apiKey);
      return NextResponse.json({ error: 'API key expired' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(keyData.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    });
  } catch (error) {
    console.error('Error verifying API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
