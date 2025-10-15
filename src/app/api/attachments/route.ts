import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import AttachmentLink from '@/models/AttachmentLink';
import Event from '@/models/Event';
import Entity from '@/models/Entity';
import { authOptions } from '@/lib/auth';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const entityId = searchParams.get('entityId');

    if (!eventId && !entityId) {
      return NextResponse.json({ error: 'Event ID or Entity ID is required' }, { status: 400 });
    }

    await dbConnect();

    // Ensure Attachment model is loaded before populate
    if (!Attachment) {
      console.error('Attachment model not loaded');
    }

    // Verify ownership based on the type
    if (eventId) {
      const event = await Event.findOne({
        _id: eventId,
        createdBy: session.user.id,
      });

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      // Find attachments linked to this event
      const attachmentLinks = await AttachmentLink.find({ eventId })
        .populate({
          path: 'attachmentId',
          model: Attachment
        })
        .sort({ createdAt: -1 });

      const attachments = attachmentLinks.map(link => ({
        _id: link.attachmentId._id,
        filename: link.attachmentId.filename,
        originalName: link.attachmentId.originalName,
        mimeType: link.attachmentId.mimeType,
        size: link.attachmentId.size,
        url: link.attachmentId.url,
        type: link.attachmentId.type,
        caption: link.attachmentId.caption,
        altText: link.attachmentId.altText,
        creator: link.attachmentId.creator,
        creditLine: link.attachmentId.creditLine,
        copyright: link.attachmentId.copyright,
        date: link.attachmentId.date,
      }));

      return NextResponse.json(attachments);
    } else {
      const entity = await Entity.findOne({
        _id: entityId,
        createdBy: session.user.id,
      });

      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }

      // Find attachments linked to this entity
      const attachmentLinks = await AttachmentLink.find({ entityId })
        .populate({
          path: 'attachmentId',
          model: Attachment
        })
        .sort({ createdAt: -1 });

      const attachments = attachmentLinks.map(link => ({
        _id: link.attachmentId._id,
        filename: link.attachmentId.filename,
        originalName: link.attachmentId.originalName,
        mimeType: link.attachmentId.mimeType,
        size: link.attachmentId.size,
        url: link.attachmentId.url,
        type: link.attachmentId.type,
        caption: link.attachmentId.caption,
        altText: link.attachmentId.altText,
        creator: link.attachmentId.creator,
        creditLine: link.attachmentId.creditLine,
        copyright: link.attachmentId.copyright,
        date: link.attachmentId.date,
      }));

      return NextResponse.json(attachments);
    }
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, originalName, type, metadata, eventId, entityId } = await request.json();

    if (!url || !originalName) {
      return NextResponse.json({ error: 'URL and originalName are required' }, { status: 400 });
    }

    if (!eventId && !entityId) {
      return NextResponse.json({ error: 'Event ID or Entity ID is required' }, { status: 400 });
    }

    await dbConnect();

    // Verify ownership based on the type
    if (eventId) {
      const event = await Event.findOne({
        _id: eventId,
        createdBy: session.user.id,
      });

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
    }

    if (entityId) {
      const entity = await Entity.findOne({
        _id: entityId,
        createdBy: session.user.id,
      });

      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }
    }

    // Download the image from URL
    let buffer: Buffer;
    let mimeType: string;
    let fileSize: number;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: HTTP ${response.status}`);
      }

      // Get MIME type from response
      mimeType = response.headers.get('content-type') || 'application/octet-stream';

      // Validate it's an image
      if (!mimeType.startsWith('image/')) {
        return NextResponse.json({ error: 'URL does not point to a valid image' }, { status: 400 });
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileSize = buffer.length;

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024;
      if (fileSize > maxSize) {
        return NextResponse.json({ error: 'Image size too large. Maximum 50MB allowed.' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error downloading image from URL:', error);
      // Return success with skipped flag instead of error - allows parsing to continue
      return NextResponse.json({
        skipped: true,
        reason: error instanceof Error ? error.message : 'Unknown error',
        url,
      }, { status: 200 });
    }

    // Calculate content hash using SHA-256
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    // Check if attachment with this content hash already exists
    let attachment = await Attachment.findOne({ contentHash });

    if (!attachment) {
      // Generate unique filename
      const extension = originalName.split('.').pop() || 'jpg';
      const uniqueFilename = `${uuidv4()}.${extension}`;

      // Determine attachment type from MIME type if not provided
      let finalType = type || 'photo';
      if (!type || type === 'other') {
        if (mimeType.startsWith('image/')) finalType = 'photo';
        else if (mimeType.startsWith('video/')) finalType = 'video';
        else if (mimeType.startsWith('audio/')) finalType = 'audio';
        else finalType = 'other';
      }

      // Create new attachment record with downloaded data
      attachment = await Attachment.create({
        filename: uniqueFilename,
        originalName,
        mimeType,
        size: fileSize,
        url: `/api/attachments/serve/${contentHash}`,
        type: finalType,
        contentHash,
        data: buffer,
        caption: metadata?.caption,
        altText: metadata?.alt,
        creator: metadata?.creator,
        creditLine: metadata?.creditLine,
        copyright: metadata?.copyright,
        date: metadata?.date ? new Date(metadata.date) : undefined,
        createdBy: session.user.id,
      });
    } else {
      // Update metadata on existing attachment if provided
      if (metadata?.caption || metadata?.alt || metadata?.creator ||
          metadata?.creditLine || metadata?.copyright || metadata?.date) {
        attachment = await Attachment.findByIdAndUpdate(
          attachment._id,
          {
            caption: metadata?.caption,
            altText: metadata?.alt,
            creator: metadata?.creator,
            creditLine: metadata?.creditLine,
            copyright: metadata?.copyright,
            date: metadata?.date ? new Date(metadata.date) : undefined,
          },
          { new: true }
        );
      }
    }

    // Create link between attachment and entity/event
    await AttachmentLink.create({
      attachmentId: attachment._id,
      ...(eventId && { eventId }),
      ...(entityId && { entityId }),
      createdBy: session.user.id,
    });

    return NextResponse.json({
      _id: attachment._id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      type: attachment.type,
      caption: attachment.caption,
      altText: attachment.altText,
      creator: attachment.creator,
      creditLine: attachment.creditLine,
      copyright: attachment.copyright,
      date: attachment.date,
    });

  } catch (error) {
    console.error('Error creating attachment from URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

