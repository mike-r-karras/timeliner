import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShareLink from '@/models/ShareLink';
import Event from '@/models/Event';

// GET - Get events by share ID (no auth required)
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

    // Get events
    const events = await Event.find({ timelineId: shareLink.timelineId }).sort({ startDate: 1 });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching shared events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
