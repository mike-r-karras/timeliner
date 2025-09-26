import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
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

      const attachments = await Attachment.find({ eventId })
        .sort({ createdAt: -1 });

      return NextResponse.json(attachments);
    } else {
      const entity = await Entity.findOne({
        _id: entityId,
        createdBy: session.user.id,
      });

      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }

      const attachments = await Attachment.find({ entityId })
        .sort({ createdAt: -1 });

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

    const {
      filename,
      originalName,
      mimeType,
      size,
      url,
      type,
      eventId,
      entityId,
    } = await request.json();

    if (!filename || !originalName || !mimeType || !size || !url || !type || (!eventId && !entityId)) {
      return NextResponse.json(
        { error: 'Missing required attachment fields' },
        { status: 400 }
      );
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

      const attachment = await Attachment.create({
        filename,
        originalName,
        mimeType,
        size,
        url,
        type,
        eventId,
        createdBy: session.user.id,
      });

      return NextResponse.json(attachment, { status: 201 });
    } else {
      const entity = await Entity.findOne({
        _id: entityId,
        createdBy: session.user.id,
      });

      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }

      const attachment = await Attachment.create({
        filename,
        originalName,
        mimeType,
        size,
        url,
        type,
        entityId,
        createdBy: session.user.id,
      });

      return NextResponse.json(attachment, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}