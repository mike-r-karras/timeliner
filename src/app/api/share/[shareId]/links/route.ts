import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShareLink from '@/models/ShareLink';
import Link from '@/models/Link';

// GET - Get links by share ID (no auth required)
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

    // Get links
    const links = await Link.find({ timelineId: shareLink.timelineId });

    // Group by eventId
    const grouped: Record<string, any[]> = {};
    links.forEach((link) => {
      const key = link.eventId?.toString();
      if (key) {
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(link);
      }
    });

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Error fetching shared links:', error);
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}
