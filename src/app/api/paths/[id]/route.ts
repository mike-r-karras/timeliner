import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Path from '@/models/Path';
import Timeline from '@/models/Timeline';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const path = await Path.findOne({
      _id: id,
      createdBy: session.user.id,
    });

    if (!path) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    const pathData = path.toObject();

    return NextResponse.json(pathData);
  } catch (error) {
    console.error('Error fetching path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    await dbConnect();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
    if (routed !== undefined) updateData.routed = routed;
    if (mode !== undefined) updateData.mode = mode;
    if (icon !== undefined) updateData.icon = icon;
    if (startLocationName !== undefined) updateData.startLocationName = startLocationName;
    if (startStreetAddress !== undefined) updateData.startStreetAddress = startStreetAddress;
    if (startCity !== undefined) updateData.startCity = startCity;
    if (startStateProvince !== undefined) updateData.startStateProvince = startStateProvince;
    if (startPostalCode !== undefined) updateData.startPostalCode = startPostalCode;
    if (startCountry !== undefined) updateData.startCountry = startCountry;
    if (startLatitude !== undefined) updateData.startLatitude = startLatitude;
    if (startLongitude !== undefined) updateData.startLongitude = startLongitude;
    if (endLocationName !== undefined) updateData.endLocationName = endLocationName;
    if (endStreetAddress !== undefined) updateData.endStreetAddress = endStreetAddress;
    if (endCity !== undefined) updateData.endCity = endCity;
    if (endStateProvince !== undefined) updateData.endStateProvince = endStateProvince;
    if (endPostalCode !== undefined) updateData.endPostalCode = endPostalCode;
    if (endCountry !== undefined) updateData.endCountry = endCountry;
    if (endLatitude !== undefined) updateData.endLatitude = endLatitude;
    if (endLongitude !== undefined) updateData.endLongitude = endLongitude;
    if (pathStyle !== undefined) updateData.style = pathStyle;
    if (style !== undefined) updateData.style = style;

    const path = await Path.findOneAndUpdate(
      { _id: id, createdBy: session.user.id },
      updateData,
      { new: true }
    );

    if (!path) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    // Convert to plain object to ensure all fields are properly serialized
    const pathData = path.toObject();

    return NextResponse.json(pathData);
  } catch (error) {
    console.error('Error updating path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const path = await Path.findOneAndDelete({
      _id: id,
      createdBy: session.user.id,
    });

    if (!path) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Path deleted successfully' });
  } catch (error) {
    console.error('Error deleting path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}