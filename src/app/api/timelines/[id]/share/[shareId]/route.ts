import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Timeline from '@/models/Timeline';
import ShareLink from '@/models/ShareLink';

// DELETE - Revoke a share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; shareId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const timelineId = params.id;
    const shareId = params.shareId;

    // Verify timeline exists and user has access
    const timeline = await Timeline.findById(timelineId);
    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    if (timeline.userId !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find and deactivate the share link
    const shareLink = await ShareLink.findOne({ shareId, timelineId });
    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    shareLink.isActive = false;
    await shareLink.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking share link:', error);
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 });
  }
}
