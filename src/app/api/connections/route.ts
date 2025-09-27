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

    const connections = await Connection.find({ timelineId })
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
      relationshipType,
      tags,
      description,
      startArrow,
      endArrow,
      timelineId,
    } = await request.json();

    if (!type || !sourceId || !targetId || !relationshipType?.trim() || !timelineId) {
      return NextResponse.json(
        { error: 'Type, source ID, target ID, relationship type, and timeline ID are required' },
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

    const connection = await Connection.create({
      type,
      sourceId,
      targetId,
      relationshipType: relationshipType.trim(),
      tags: tags || [],
      description: description?.trim(),
      startArrow: startArrow || 'none',
      endArrow: endArrow || 'none',
      timelineId,
      createdBy: session.user.id,
    });

    const populatedConnection = await Connection.findById(connection._id)
      .populate('sourceId')
      .populate('targetId');

    return NextResponse.json(populatedConnection, { status: 201 });
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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