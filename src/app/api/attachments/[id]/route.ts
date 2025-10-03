import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import AttachmentLink from '@/models/AttachmentLink';
import { authOptions } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Convert empty strings to undefined
    const caption = body.caption?.trim() || undefined;
    const altText = body.altText?.trim() || undefined;
    const creator = body.creator?.trim() || undefined;
    const creditLine = body.creditLine?.trim() || undefined;
    const copyright = body.copyright?.trim() || undefined;
    const date = body.date ? new Date(body.date) : undefined;

    await dbConnect();

    // Verify user has access to this attachment
    const attachmentLink = await AttachmentLink.findOne({
      attachmentId: id,
      createdBy: session.user.id,
    });

    if (!attachmentLink) {
      return NextResponse.json({ error: 'Attachment not found or unauthorized' }, { status: 404 });
    }

    // Update attachment metadata
    const updatedAttachment = await Attachment.findByIdAndUpdate(
      id,
      {
        caption,
        altText,
        creator,
        creditLine,
        copyright,
        date,
      },
      { new: true }
    );

    if (!updatedAttachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Attachment metadata updated successfully',
      attachment: {
        _id: updatedAttachment._id,
        filename: updatedAttachment.filename,
        originalName: updatedAttachment.originalName,
        mimeType: updatedAttachment.mimeType,
        size: updatedAttachment.size,
        url: updatedAttachment.url,
        type: updatedAttachment.type,
        caption: updatedAttachment.caption,
        altText: updatedAttachment.altText,
        creator: updatedAttachment.creator,
        creditLine: updatedAttachment.creditLine,
        copyright: updatedAttachment.copyright,
        date: updatedAttachment.date,
      },
    });
  } catch (error) {
    console.error('Error updating attachment metadata:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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