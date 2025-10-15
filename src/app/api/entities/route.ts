import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Entity from '@/models/Entity';
import Timeline from '@/models/Timeline';
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

    const entities = await Entity.find({ timelineId })
      .populate('locationId')
      .sort({ name: 1 });

    // Debug logging for map issue
    console.log('=== ENTITIES DEBUG ===');
    console.log('Total entities found:', entities.length);
    entities.forEach((entity, index) => {
      console.log(`Entity ${index + 1}: ${entity.name} (${entity.type})`);
      console.log('  locationId:', entity.locationId ? 'has location' : 'no location');
      if (entity.locationId) {
        const loc = entity.locationId as any;
        console.log('  location details:', {
          name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          hasValidCoords: !!(loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude))
        });
      }
    });

    return NextResponse.json(entities);
  } catch (error) {
    console.error('Error fetching entities:', error);
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
      name,
      type,
      description,
      importance,
      locationId,
      timelineId,
    } = await request.json();

    if (!name?.trim() || !type || !timelineId) {
      return NextResponse.json(
        { error: 'Name, type, and timeline ID are required' },
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

    // Check if entity with same name and type already exists in this timeline
    const existingEntity = await Entity.findOne({
      name: name.trim(),
      type,
      timelineId,
    });

    if (existingEntity) {
      console.log(`Entity already exists: ${existingEntity.name} (${existingEntity.type}) - returning existing entity`);
      return NextResponse.json(existingEntity, { status: 200 });
    }

    const entity = await Entity.create({
      name: name.trim(),
      type,
      description: description?.trim(),
      importance: importance || 3,
      ...(locationId && { locationId }),
      timelineId,
      createdBy: session.user.id,
    });

    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}