import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Timeline from '@/models/Timeline';
import User from '@/models/User';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // First, try to get user's last timeline
    const user = await User.findById(session.user.id);
    let timeline = null;

    if (user?.lastTimelineId) {
      timeline = await Timeline.findOne({
        _id: user.lastTimelineId,
        createdBy: session.user.id,
      });
    }

    // If no last timeline or it doesn't exist, get the most recent timeline
    if (!timeline) {
      timeline = await Timeline.findOne({ createdBy: session.user.id })
        .sort({ updatedAt: -1 });
    }

    if (!timeline) {
      return NextResponse.json({ error: 'No timeline found' }, { status: 404 });
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Error fetching current timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}