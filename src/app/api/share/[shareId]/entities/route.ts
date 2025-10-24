import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ShareLink from '@/models/ShareLink';
import Entity from '@/models/Entity';

// GET - Get entities by share ID (no auth required)
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

    // Get entities
    const entities = await Entity.find({ timelineId: shareLink.timelineId }).sort({ name: 1 });

    return NextResponse.json(entities);
  } catch (error) {
    console.error('Error fetching shared entities:', error);
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }
}
