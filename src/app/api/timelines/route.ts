import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Timeline from '@/models/Timeline';
import User from '@/models/User';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const timelines = await Timeline.find({ createdBy: session.user.id })
      .sort({ updatedAt: -1 });

    return NextResponse.json(timelines);
  } catch (error) {
    console.error('Error fetching timelines:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description } = await request.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await dbConnect();

    const timeline = await Timeline.create({
      title: title.trim(),
      description: description?.trim(),
      createdBy: session.user.id,
    });

    // Update user's lastTimelineId
    await User.findByIdAndUpdate(session.user.id, {
      lastTimelineId: timeline._id,
    });

    return NextResponse.json(timeline, { status: 201 });
  } catch (error) {
    console.error('Error creating timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}