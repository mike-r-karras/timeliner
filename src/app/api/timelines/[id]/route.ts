import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Timeline from '@/models/Timeline';
import User from '@/models/User';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const timeline = await Timeline.findOne({
      _id: id,
      createdBy: session.user.id,
    });

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, timezone } = await request.json();

    await dbConnect();

    const { id } = await params;
    const timeline = await Timeline.findOneAndUpdate(
      { _id: id, createdBy: session.user.id },
      {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(timezone !== undefined && { timezone: timezone.trim() }),
      },
      { new: true }
    );

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    // Update user's lastTimelineId
    await User.findByIdAndUpdate(session.user.id, {
      lastTimelineId: timeline._id,
    });

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Error updating timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const timeline = await Timeline.findOneAndDelete({
      _id: id,
      createdBy: session.user.id,
    });

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Timeline deleted successfully' });
  } catch (error) {
    console.error('Error deleting timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}