import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Event from '@/models/Event';
import Timeline from '@/models/Timeline';
import Location from '@/models/Location';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timelineId = searchParams.get('timelineId');

    if (!timelineId) {
      return NextResponse.json({ error: 'Timeline ID is required' }, { status: 400 });
    }

    await dbConnect();

    // Verify timeline ownership
    const timeline = await Timeline.findOne({
      _id: timelineId,
      createdBy: session.user.id,
    });

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const events = await Event.find({ timelineId })
      .populate('locationId')
      .sort({ startDateTime: 1 });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
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
      title,
      description,
      startDateTime,
      endDateTime,
      importance,
      locationId,
      timelineId,
    } = await request.json();

    if (!title?.trim() || !startDateTime || !timelineId) {
      return NextResponse.json(
        { error: 'Title, start date, and timeline ID are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify timeline ownership
    const timeline = await Timeline.findOne({
      _id: timelineId,
      createdBy: session.user.id,
    });

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const event = await Event.create({
      title: title.trim(),
      description: description?.trim(),
      startDateTime: new Date(startDateTime),
      endDateTime: endDateTime ? new Date(endDateTime) : undefined,
      importance: Math.max(1, Math.min(5, importance || 3)),
      locationId: locationId || undefined,
      timelineId,
      createdBy: session.user.id,
    });

    const populatedEvent = await Event.findById(event._id).populate('locationId');

    return NextResponse.json(populatedEvent, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}