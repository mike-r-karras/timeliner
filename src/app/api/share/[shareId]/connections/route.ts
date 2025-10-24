import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShareLink from '@/models/ShareLink';
import Connection from '@/models/Connection';

// GET - Get connections by share ID (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    await dbConnect();

    const shareId = params.shareId;
    const { searchParams } = new URL(request.url);
    const eventIds = searchParams.get('eventIds')?.split(',');

    // Find active share link
    const shareLink = await ShareLink.findOne({ shareId, isActive: true });
    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
    }

    // Check if expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    // Get connections
    const query: any = { timelineId: shareLink.timelineId };

    // If eventIds provided, filter by those events
    if (eventIds && eventIds.length > 0) {
      query.$or = [
        { sourceId: { $in: eventIds }, sourceModel: 'Event' },
        { targetId: { $in: eventIds }, targetModel: 'Event' }
      ];
    }

    const connections = await Connection.find(query)
      .populate('sourceId')
      .populate('targetId');

    return NextResponse.json(connections);
  } catch (error) {
    console.error('Error fetching shared connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}
