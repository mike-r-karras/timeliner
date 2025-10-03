import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Timeline from '@/models/Timeline';
import Event from '@/models/Event';
import Entity from '@/models/Entity';
import Location from '@/models/Location';
import User from '@/models/User';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();

    await dbConnect();

    const { id } = await params;

    // Get the original timeline
    const originalTimeline = await Timeline.findOne({
      _id: id,
      createdBy: session.user.id,
    });

    if (!originalTimeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    // Create new timeline
    const newTimeline = await Timeline.create({
      title: title || `${originalTimeline.title} (Copy)`,
      description: originalTimeline.description,
      createdBy: session.user.id,
    });

    // Duplicate all related data
    const [events, entities, locations] = await Promise.all([
      Event.find({ timelineId: id }),
      Entity.find({ timelineId: id }),
      Location.find({ timelineId: id })
    ]);

    // Create mapping for old -> new IDs
    const locationIdMap = new Map();
    const entityIdMap = new Map();

    // Duplicate locations first
    if (locations.length > 0) {
      const duplicatedLocations = await Location.insertMany(
        locations.map(location => ({
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          timelineId: newTimeline._id,
        }))
      );

      locations.forEach((original, index) => {
        locationIdMap.set(original._id.toString(), duplicatedLocations[index]._id);
      });
    }

    // Duplicate entities
    if (entities.length > 0) {
      const duplicatedEntities = await Entity.insertMany(
        entities.map(entity => ({
          name: entity.name,
          type: entity.type,
          description: entity.description,
          importance: entity.importance,
          locationId: entity.locationId ? locationIdMap.get(entity.locationId.toString()) : undefined,
          timelineId: newTimeline._id,
        }))
      );

      entities.forEach((original, index) => {
        entityIdMap.set(original._id.toString(), duplicatedEntities[index]._id);
      });
    }

    // Duplicate events
    if (events.length > 0) {
      const duplicatedEvents = events.map(event => ({
        title: event.title,
        description: event.description,
        date: event.date,
        endDate: event.endDate,
        type: event.type,
        importance: event.importance,
        locationId: event.locationId ? locationIdMap.get(event.locationId.toString()) : undefined,
        entityIds: event.entityIds ? event.entityIds.map((id: string) => entityIdMap.get(id.toString())).filter(Boolean) : [],
        timelineId: newTimeline._id,
      }));

      await Event.insertMany(duplicatedEvents);
    }

    // Update user's lastTimelineId to the new timeline
    await User.findByIdAndUpdate(session.user.id, {
      lastTimelineId: newTimeline._id,
    });

    return NextResponse.json(newTimeline, { status: 201 });
  } catch (error) {
    console.error('Error duplicating timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}