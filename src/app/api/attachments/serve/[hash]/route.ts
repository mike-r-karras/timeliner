import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import AttachmentLink from '@/models/AttachmentLink';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { hash } = await params;

    if (!hash) {
      return NextResponse.json({ error: 'Hash parameter is required' }, { status: 400 });
    }

    await dbConnect();

    // Find attachment by content hash
    const attachment = await Attachment.findOne({ contentHash: hash });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Verify user has access to this attachment through AttachmentLink
    const attachmentLink = await AttachmentLink.findOne({
      attachmentId: attachment._id,
      createdBy: session.user.id,
    }).populate('eventId entityId');

    if (!attachmentLink) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Set appropriate headers for file serving
    const headers = new Headers();
    headers.set('Content-Type', attachment.mimeType);
    headers.set('Content-Length', attachment.size.toString());
    headers.set('Content-Disposition', `inline; filename="${attachment.originalName}"`);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year since content hash is immutable

    return new NextResponse(attachment.data, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error serving attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configure API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';