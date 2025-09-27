import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import AttachmentLink from '@/models/AttachmentLink';
import Event from '@/models/Event';
import Entity from '@/models/Entity';
import { authOptions } from '@/lib/auth';

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
        .populate('attachmentId')
        .sort({ createdAt: -1 });

      const attachments = attachmentLinks.map(link => ({
        _id: link.attachmentId._id,
        filename: link.attachmentId.filename,
        originalName: link.attachmentId.originalName,
        mimeType: link.attachmentId.mimeType,
        size: link.attachmentId.size,
        url: link.attachmentId.url,
        type: link.attachmentId.type,
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
        .populate('attachmentId')
        .sort({ createdAt: -1 });

      const attachments = attachmentLinks.map(link => ({
        _id: link.attachmentId._id,
        filename: link.attachmentId.filename,
        originalName: link.attachmentId.originalName,
        mimeType: link.attachmentId.mimeType,
        size: link.attachmentId.size,
        url: link.attachmentId.url,
        type: link.attachmentId.type,
      }));

      return NextResponse.json(attachments);
    }
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

