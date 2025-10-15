import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Connection from '@/models/Connection';
import Timeline from '@/models/Timeline';
import { authOptions } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 });
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

    // Find the connection first
    const connection = await Connection.findById(id);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Verify timeline ownership
    const timeline = await Timeline.findOne({
      _id: connection.timelineId,
      createdBy: session.user.id,
    });

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found or unauthorized' }, { status: 404 });
    }

    // Update the connection
    const updatedConnection = await Connection.findByIdAndUpdate(
      id,
      {
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
      },
      { new: true, runValidators: true }
    )
      .populate('sourceId')
      .populate('targetId');

    return NextResponse.json(updatedConnection, { status: 200 });
  } catch (error: any) {
    console.error('Error updating connection:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    const errorMessage = process.env.NODE_ENV === 'development'
      ? `${error.name}: ${error.message}`
      : 'Internal server error';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 });
    }

    await dbConnect();

    // Find the connection first
    const connection = await Connection.findById(id);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Verify timeline ownership through the connection
    const timeline = await Timeline.findOne({
      _id: connection.timelineId,
      createdBy: session.user.id,
    });

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found or unauthorized' }, { status: 404 });
    }

    // Delete the connection
    await Connection.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Connection deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}