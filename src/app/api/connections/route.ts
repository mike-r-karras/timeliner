import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Connection from '@/models/Connection';
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
    const eventIds = searchParams.get('eventIds'); // Comma-separated list of event IDs

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

    // Build query
    const query: any = { timelineId };

    // If eventIds provided, filter connections where sourceId or targetId is in the event list
    if (eventIds) {
      const eventIdArray = eventIds.split(',').map(id => id.trim());
      query.$or = [
        { sourceId: { $in: eventIdArray }, sourceModel: 'Event' },
        { targetId: { $in: eventIdArray }, targetModel: 'Event' }
      ];
    }

    const connections = await Connection.find(query)
      .populate('sourceId')
      .populate('targetId')
      .sort({ createdAt: -1 });

    return NextResponse.json(connections);
  } catch (error) {
    console.error('Error fetching connections:', error);
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
      type,
      sourceId,
      targetId,
      sourceModel,
      targetModel,
      relationshipType,
      tags,
      description,
      startArrow,
      endArrow,
      timelineId,
    } = await request.json();

    if (!type || !sourceId || !targetId || !sourceModel || !targetModel || !relationshipType?.trim() || !timelineId) {
      return NextResponse.json(
        { error: 'Type, source ID, target ID, source model, target model, relationship type, and timeline ID are required' },
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

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      sourceId,
      targetId,
      timelineId,
    });

    if (existingConnection) {
      return NextResponse.json({ error: 'Connection already exists' }, { status: 409 });
    }

    console.log('Creating connection with data:', {
      type,
      sourceId,
      targetId,
      sourceModel,
      targetModel,
      relationshipType,
      timelineId,
      createdBy: session.user.id,
    });

    const connection = await Connection.create({
      type,
      sourceId,
      targetId,
      sourceModel,
      targetModel,
      relationshipType: relationshipType.trim(),
      tags: tags || [],
      description: description?.trim(),
      startArrow: startArrow || 'none',
      endArrow: endArrow || 'none',
      timelineId,
      createdBy: session.user.id,
    });

    console.log('Connection created successfully:', connection._id);

    const populatedConnection = await Connection.findById(connection._id)
      .populate('sourceId')
      .populate('targetId');

    return NextResponse.json(populatedConnection, { status: 201 });
  } catch (error: any) {
    console.error('Error creating connection:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `${error.name}: ${error.message}`
      : 'Internal server error';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    // Delete all connections for this timeline
    const result = await Connection.deleteMany({ timelineId });

    return NextResponse.json({
      message: 'All connections deleted',
      deletedCount: result.deletedCount
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}