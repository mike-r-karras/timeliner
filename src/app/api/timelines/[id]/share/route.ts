import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Timeline from '@/models/Timeline';
import ShareLink from '@/models/ShareLink';
import { randomBytes } from 'crypto';

// Generate a unique share ID
function generateShareId(): string {
  return randomBytes(16).toString('base64url'); // URL-safe random string
}

// POST - Create a new share link
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const timelineId = params.id;

    // Verify timeline exists and user has access
    const timeline = await Timeline.findById(timelineId);
    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    if (timeline.userId !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate unique share ID
    let shareId = generateShareId();
    let attempts = 0;
    while (await ShareLink.findOne({ shareId }) && attempts < 10) {
      shareId = generateShareId();
      attempts++;
    }

    // Create share link
    const shareLink = await ShareLink.create({
      timelineId,
      shareId,
      isActive: true,
    });

    const baseUrl = request.nextUrl.origin;
    const shareUrl = `${baseUrl}/share/${shareId}`;

    return NextResponse.json({
      shareId: shareLink.shareId,
      url: shareUrl,
      createdAt: shareLink.createdAt,
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

// GET - List all share links for a timeline
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const timelineId = params.id;

    // Verify timeline exists and user has access
    const timeline = await Timeline.findById(timelineId);
    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    if (timeline.userId !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all share links for this timeline
    const shareLinks = await ShareLink.find({ timelineId, isActive: true }).sort({ createdAt: -1 });

    const baseUrl = request.nextUrl.origin;
    const shares = shareLinks.map(share => ({
      shareId: share.shareId,
      url: `${baseUrl}/share/${share.shareId}`,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    }));

    return NextResponse.json(shares);
  } catch (error) {
    console.error('Error fetching share links:', error);
    return NextResponse.json({ error: 'Failed to fetch share links' }, { status: 500 });
  }
}
