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

    console.log('GET events - sample chainIds:', events[0]?.chainIds);

    // Ensure chainIds and footnotes exist for backward compatibility with old events
    const eventsData = events.map(event => {
      const eventObj = event.toObject();
      if (!eventObj.chainIds) {
        eventObj.chainIds = [];
      }
      if (!eventObj.footnotes) {
        eventObj.footnotes = [];
      }

      // Convert ObjectIds to strings in footnotes for proper serialization
      if (eventObj.footnotes && eventObj.footnotes.length > 0) {
        eventObj.footnotes = eventObj.footnotes.map((fn: any) => ({
          number: fn.number,
          type: fn.type,
          referenceId: fn.referenceId.toString(),
          pageRange: fn.pageRange,
          customSource: fn.customSource,
          date: fn.date,
        }));
      }

      return eventObj;
    });

    return NextResponse.json(eventsData);
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
      chainIds,
      footnotes,
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
      chainIds: Array.isArray(chainIds) ? chainIds : [],
      footnotes: Array.isArray(footnotes) ? footnotes : [],
      createdBy: session.user.id,
    });

    const populatedEvent = await Event.findById(event._id).populate('locationId');

    console.log('Created event with chainIds:', populatedEvent?.chainIds);

    // Ensure chainIds and footnotes exist in response
    const eventData = populatedEvent?.toObject();
    if (eventData) {
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
        }));
      }
    }

    return NextResponse.json(eventData, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}