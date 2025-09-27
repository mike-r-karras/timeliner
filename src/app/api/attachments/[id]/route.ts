import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import AttachmentLink from '@/models/AttachmentLink';
import { authOptions } from '@/lib/auth';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await dbConnect();

    // Find the attachment link to delete (id is the attachment ID)
    const attachmentLink = await AttachmentLink.findOne({
      attachmentId: id,
      createdBy: session.user.id,
    });

    if (!attachmentLink) {
      return NextResponse.json({ error: 'Attachment link not found' }, { status: 404 });
    }

    // Delete the attachment link
    await AttachmentLink.findByIdAndDelete(attachmentLink._id);

    // Check if there are any other links to this attachment
    const remainingLinks = await AttachmentLink.countDocuments({ attachmentId: id });

    // If no other links exist, we could optionally delete the attachment data
    // For now, we'll keep the attachment data for potential future deduplication
    // This allows the same file content to be used by multiple entities/events

    return NextResponse.json({ message: 'Attachment link deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}