import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import AttachmentLink from '@/models/AttachmentLink';
import Event from '@/models/Event';
import Entity from '@/models/Entity';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const eventId = data.get('eventId') as string;
    const entityId = data.get('entityId') as string;
    const attachmentType = data.get('type') as string || 'other';

    // Extract metadata, converting empty strings and null to undefined
    const caption = (data.get('caption') as string)?.trim() || undefined;
    const altText = (data.get('altText') as string)?.trim() || undefined;
    const creator = (data.get('creator') as string)?.trim() || undefined;
    const creditLine = (data.get('creditLine') as string)?.trim() || undefined;
    const copyright = (data.get('copyright') as string)?.trim() || undefined;
    const dateStr = (data.get('date') as string)?.trim() || undefined;
    const date = dateStr ? new Date(dateStr) : undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!eventId && !entityId) {
      return NextResponse.json({ error: 'Event ID or Entity ID is required' }, { status: 400 });
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size too large. Maximum 50MB allowed.' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Calculate content hash using SHA-256
    const contentHash = createHash('sha256').update(buffer).digest('hex');

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

    // Check if attachment with this content hash already exists
    let attachment = await Attachment.findOne({ contentHash });

    if (!attachment) {
      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || '';
      const uniqueFilename = `${uuidv4()}.${fileExtension}`;

      // Determine attachment type from MIME type if not provided
      let finalType = attachmentType;
      if (!attachmentType || attachmentType === 'other') {
        if (file.type.startsWith('image/')) finalType = 'photo';
        else if (file.type.startsWith('video/')) finalType = 'video';
        else if (file.type.startsWith('audio/')) finalType = 'audio';
        else if (file.type === 'application/pdf') finalType = 'document';
        else if (file.type.includes('text/')) finalType = 'document';
        else finalType = 'other';
      }

      // Create new attachment record with binary data in MongoDB
      attachment = await Attachment.create({
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: `/api/attachments/serve/${contentHash}`, // API endpoint to serve the file
        type: finalType,
        contentHash,
        data: buffer,
        caption,
        altText,
        creator,
        creditLine,
        copyright,
        date,
        createdBy: session.user.id,
      });
    } else {
      // Update metadata on existing attachment if provided
      if (caption !== undefined || altText !== undefined || creator !== undefined ||
          creditLine !== undefined || copyright !== undefined || date !== undefined) {
        attachment = await Attachment.findByIdAndUpdate(
          attachment._id,
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
      }
    }

    // Create link between attachment and entity/event
    const attachmentLink = await AttachmentLink.create({
      attachmentId: attachment._id,
      ...(eventId && { eventId }),
      ...(entityId && { entityId }),
      createdBy: session.user.id,
    });

    return NextResponse.json({
      message: 'File uploaded successfully',
      attachment: {
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
      },
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configure API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';