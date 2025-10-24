import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShareLink from '@/models/ShareLink';
import Attachment from '@/models/Attachment';

// GET - Get attachments by share ID (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    await dbConnect();

    const shareId = params.shareId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'events' or 'entities'

    // Find active share link
    const shareLink = await ShareLink.findOne({ shareId, isActive: true });
    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
    }

    // Check if expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    // Get attachments
    const query: any = { timelineId: shareLink.timelineId };

    if (type === 'events') {
      query.eventId = { $ne: null };
    } else if (type === 'entities') {
      query.entityId = { $ne: null };
    }

    const attachments = await Attachment.find(query);

    // Group by eventId or entityId
    const grouped: Record<string, any[]> = {};
    attachments.forEach((attachment) => {
      const key = type === 'events'
        ? attachment.eventId?.toString()
        : attachment.entityId?.toString();

      if (key) {
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(attachment);
      }
    });

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Error fetching shared attachments:', error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}
