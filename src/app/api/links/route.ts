import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Link from '@/models/Link';
import LinkLink from '@/models/LinkLink';
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
    const timelineId = searchParams.get('timelineId');

    if (!eventId && !entityId && !timelineId) {
      return NextResponse.json({ error: 'Event ID, Entity ID, or Timeline ID is required' }, { status: 400 });
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

      // Find links linked to this event
      const linkLinks = await LinkLink.find({ eventId })
        .populate('linkId')
        .sort({ createdAt: -1 });

      const links = linkLinks.map(linkLink => ({
        _id: linkLink.linkId._id,
        title: linkLink.linkId.title,
        url: linkLink.linkId.url,
      }));

      return NextResponse.json(links);
    } else if (entityId) {
      const entity = await Entity.findOne({
        _id: entityId,
        createdBy: session.user.id,
      });

      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }

      // Find links linked to this entity
      const linkLinks = await LinkLink.find({ entityId })
        .populate('linkId')
        .sort({ createdAt: -1 });

      const links = linkLinks.map(linkLink => ({
        _id: linkLink.linkId._id,
        title: linkLink.linkId.title,
        url: linkLink.linkId.url,
      }));

      return NextResponse.json(links);
    } else if (timelineId) {
      // Fetch all events in the timeline
      const events = await Event.find({
        timelineId,
        createdBy: session.user.id,
      });

      if (events.length === 0) {
        return NextResponse.json({});
      }

      const eventIds = events.map(e => e._id);

      // Find all links for these events
      const linkLinks = await LinkLink.find({
        eventId: { $in: eventIds }
      })
        .populate('linkId')
        .sort({ createdAt: -1 });

      // Group by eventId
      const linksByEvent: Record<string, any[]> = {};
      linkLinks.forEach(linkLink => {
        const evtId = String(linkLink.eventId);
        if (!linksByEvent[evtId]) {
          linksByEvent[evtId] = [];
        }
        linksByEvent[evtId].push({
          _id: linkLink.linkId._id,
          title: linkLink.linkId.title,
          url: linkLink.linkId.url,
        });
      });

      return NextResponse.json(linksByEvent);
    }
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, url, eventId, entityId } = body;

    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 });
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

    // Create new link record
    const link = await Link.create({
      title: title.trim(),
      url: url.trim(),
      createdBy: session.user.id,
    });

    // Create link between link and entity/event
    await LinkLink.create({
      linkId: link._id,
      ...(eventId && { eventId }),
      ...(entityId && { entityId }),
      createdBy: session.user.id,
    });

    return NextResponse.json({
      message: 'Link created successfully',
      link: {
        _id: link._id,
        title: link.title,
        url: link.url,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
