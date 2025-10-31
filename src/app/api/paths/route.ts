import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Path from '@/models/Paths';
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

    const paths = await Path.find({ timelineId })
      .sort({ startDateTime: 1 });

    console.log('GET paths', paths[0]);


    return NextResponse.json(paths, { status: 200 });
  } catch (error) {
    console.error('Error fetching paths:', error);
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
          routed,
          mode,
          icon,
          startLocationName,
          startStreetAddress,
          startCity,
          startStateProvince,
          startPostalCode,
          startCountry,
          startLatitude,
          startLongitude,
          endLocationName,
          endStreetAddress,
          endCity,
          endStateProvince,
          endPostalCode,
          endCountry,
          endLatitude,
          endLongitude,
          description,
          startTime,
          endTime,
          pathStyle,
          style,
          timelineId,
    } = await request.json();

    if (!name?.trim() || !startTime || !timelineId) {
        console.log(name, startTime, timelineId);
      return NextResponse.json(
        { error: 'Title, start dateTime, and timeline ID are required' },
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

    const path = await Path.create({
      name: name.trim(),
      description: description?.trim(),
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : undefined,
      timelineId,
        routed,
        mode,
        icon: icon?.trim(),
        startLocationName: startLocationName?.trim(),
        startStreetAddress: startStreetAddress?.trim(),
        startCity: startCity?.trim(),
        startStateProvince: startStateProvince?.trim(),
        startPostalCode: startPostalCode?.trim(),
        startCountry: startCountry?.trim(),
        startLatitude,
        startLongitude,
        endLocationName: endLocationName?.trim(),
        endStreetAddress: endStreetAddress?.trim(),
        endCity: endCity?.trim(),
        endStateProvince: endStateProvince?.trim(),
        endPostalCode: endPostalCode?.trim(),
        endCountry: endCountry?.trim(),
        endLatitude,
        endLongitude,
        pathStyle: pathStyle ? pathStyle : undefined,
        style: style ? style : undefined,
      createdBy: session.user.id,
    });

    const pathData = await Path.findById(path._id);

    console.log('Created path:', pathData);
    return NextResponse.json(pathData, { status: 201 });
  } catch (error) {
    console.error('Error creating path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}