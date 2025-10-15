import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Chain from '@/models/Chain';
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

    const chains = await Chain.find({ timelineId })
      .sort({ name: 1 });

    return NextResponse.json(chains);
  } catch (error) {
    console.error('Error fetching chains:', error);
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
      color,
      description,
      timelineId,
    } = await request.json();

    if (!name?.trim() || !timelineId) {
      return NextResponse.json(
        { error: 'Name and timeline ID are required' },
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

    // Check for duplicate chain name in this timeline
    const existingChain = await Chain.findOne({
      timelineId,
      name: name.trim(),
    });

    if (existingChain) {
      return NextResponse.json(
        { error: 'A chain with this name already exists in this timeline' },
        { status: 409 }
      );
    }

    const chain = await Chain.create({
      name: name.trim(),
      color: color || '#1976d2',
      description: description?.trim(),
      timelineId,
      createdBy: session.user.id,
    });

    return NextResponse.json(chain, { status: 201 });
  } catch (error) {
    console.error('Error creating chain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
