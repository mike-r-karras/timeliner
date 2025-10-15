import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import ParsingPerformance from '@/models/ParsingPerformance';
import { authOptions } from '@/lib/auth';

// GET: Get average parsing performance for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const parsingType = searchParams.get('parsingType') as 'url' | 'file' | null;

    // Build query
    const query: any = {
      userId: session.user.id,
      success: true, // Only consider successful parses
    };

    if (parsingType) {
      query.parsingType = parsingType;
    }

    // Get recent performance metrics (last 50 successful parses)
    const recentPerformance = await ParsingPerformance
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (recentPerformance.length === 0) {
      // No historical data, return defaults
      return NextResponse.json({
        hasData: false,
        avgTokensPerSecond: 100, // Default estimate: 100 tokens/sec
        avgDurationMs: 10000, // Default estimate: 10 seconds
        sampleSize: 0,
      });
    }

    // Calculate averages
    const totalTokensPerSecond = recentPerformance.reduce((sum, p) => sum + p.tokensPerSecond, 0);
    const totalDurationMs = recentPerformance.reduce((sum, p) => sum + p.durationMs, 0);

    const avgTokensPerSecond = totalTokensPerSecond / recentPerformance.length;
    const avgDurationMs = totalDurationMs / recentPerformance.length;

    return NextResponse.json({
      hasData: true,
      avgTokensPerSecond,
      avgDurationMs,
      sampleSize: recentPerformance.length,
      model: recentPerformance[0]?.model,
    });

  } catch (error) {
    console.error('Error fetching parsing performance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Record parsing performance
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      parsingType,
      tokenCount,
      durationMs,
      model,
      success,
      errorMessage,
    } = await request.json();

    if (!parsingType || tokenCount === undefined || durationMs === undefined || !model) {
      return NextResponse.json({
        error: 'Missing required fields: parsingType, tokenCount, durationMs, model'
      }, { status: 400 });
    }

    await dbConnect();

    const tokensPerSecond = durationMs > 0 ? (tokenCount / durationMs) * 1000 : 0;

    const performance = await ParsingPerformance.create({
      userId: session.user.id,
      parsingType,
      tokenCount,
      durationMs,
      tokensPerSecond,
      model,
      success: success !== false, // Default to true
      errorMessage,
    });

    return NextResponse.json({
      message: 'Performance data recorded',
      performance: {
        _id: performance._id,
        tokensPerSecond: performance.tokensPerSecond,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error recording parsing performance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
