import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Timeline from '@/models/Timeline';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const event = await Event.findOne({
      _id: id,
      createdBy: session.user.id,
    }).populate('locationId');

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Ensure chainIds and footnotes exist for backward compatibility
    const eventData = event.toObject();
    if (!eventData.chainIds) {
      eventData.chainIds = [];
    }
    if (!eventData.footnotes) {
      eventData.footnotes = [];
    }

    // Convert ObjectIds to strings in footnotes for proper serialization
    if (eventData.footnotes && eventData.footnotes.length > 0) {
      eventData.footnotes = eventData.footnotes.map((fn: any) => ({
        number: fn.number,
        type: fn.type,
        referenceId: fn.referenceId.toString(),
        pageRange: fn.pageRange,
        customSource: fn.customSource,
        date: fn.date,
      }));
    }

    return NextResponse.json(eventData);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const {
      title,
      description,
      startDateTime,
      endDateTime,
      importance,
      locationId,
      chainIds,
      footnotes,
    } = await request.json();

    await dbConnect();

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (startDateTime !== undefined) updateData.startDateTime = new Date(startDateTime);
    if (endDateTime !== undefined) updateData.endDateTime = endDateTime ? new Date(endDateTime) : null;
    if (importance !== undefined) updateData.importance = Math.max(1, Math.min(5, importance));
    if (locationId !== undefined) updateData.locationId = locationId || null;

    // Always set chainIds to ensure the field exists in the document
    if (chainIds !== undefined) {
      updateData.chainIds = Array.isArray(chainIds) ? chainIds : [];
    }

    // Handle footnotes
    if (footnotes !== undefined) {
      updateData.footnotes = Array.isArray(footnotes) ? footnotes : [];
    }

    const event = await Event.findOneAndUpdate(
      { _id: id, createdBy: session.user.id },
      updateData,
      { new: true }
    ).populate('locationId');

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Convert to plain object to ensure all fields are properly serialized
    const eventData = event.toObject();
    if (!eventData.chainIds) {
      eventData.chainIds = [];
    }
    if (!eventData.footnotes) {
      eventData.footnotes = [];
    }

    // Convert ObjectIds to strings in footnotes for proper serialization
    if (eventData.footnotes && eventData.footnotes.length > 0) {
      eventData.footnotes = eventData.footnotes.map((fn: any) => ({
        number: fn.number,
        type: fn.type,
        referenceId: fn.referenceId.toString(),
        pageRange: fn.pageRange,
        customSource: fn.customSource,
        date: fn.date,
      }));
    }

    return NextResponse.json(eventData);
  } catch (error) {
    console.error('Error updating event:', error);
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

    const event = await Event.findOneAndDelete({
      _id: id,
      createdBy: session.user.id,
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}