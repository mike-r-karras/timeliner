import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShareLink from '@/models/ShareLink';
import Timeline from '@/models/Timeline';

// GET - Get timeline data by share ID (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    await dbConnect();

    const shareId = params.shareId;

    // Find active share link
    const shareLink = await ShareLink.findOne({ shareId, isActive: true });
    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
    }

    // Check if expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    // Get timeline
    const timeline = await Timeline.findById(shareLink.timelineId);
    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Error fetching shared timeline:', error);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}
