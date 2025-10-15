import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import { authOptions } from '@/lib/auth';
import { GeocodingService } from '@/lib/geocoding';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const location = await Location.findOne({
      _id: params.id,
      createdBy: session.user.id,
    });

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      streetAddress,
      city,
      stateProvince,
      postalCode,
      country,
      latitude,
      longitude,
      radius,
      description,
      geocodeAddress,
    } = await request.json();

    await dbConnect();

    const location = await Location.findOne({
      _id: params.id,
      createdBy: session.user.id,
    });

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    let updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (streetAddress !== undefined) updateData.streetAddress = streetAddress.trim();
    if (city !== undefined) updateData.city = city.trim();
    if (stateProvince !== undefined) updateData.stateProvince = stateProvince.trim();
    if (postalCode !== undefined) updateData.postalCode = postalCode.trim();
    if (country !== undefined) updateData.country = country.trim();
    if (radius !== undefined) updateData.radius = radius;
    if (description !== undefined) updateData.description = description.trim();

    // Handle coordinates
    if (latitude !== undefined && longitude !== undefined) {
      if (!GeocodingService.isValidCoordinates(latitude, longitude)) {
        return NextResponse.json(
          { error: 'Invalid latitude or longitude values' },
          { status: 400 }
        );
      }
      updateData.latitude = latitude;
      updateData.longitude = longitude;
      updateData.geocoded = true;
      updateData.geocodingSource = 'manual';
    } else if (geocodeAddress !== false) {
      // Attempt to geocode the address if coordinates not provided
      const addressString = GeocodingService.buildAddressString({
        streetAddress: updateData.streetAddress || location.streetAddress,
        city: updateData.city || location.city,
        stateProvince: updateData.stateProvince || location.stateProvince,
        postalCode: updateData.postalCode || location.postalCode,
        country: updateData.country || location.country,
      });

      if (addressString) {
        console.log(`Attempting to geocode: ${addressString}`);
        const geocodeResult = await GeocodingService.geocodeAddress(addressString);

        if (geocodeResult) {
          updateData.latitude = geocodeResult.latitude;
          updateData.longitude = geocodeResult.longitude;
          updateData.formattedAddress = geocodeResult.formattedAddress;
          updateData.placeId = geocodeResult.placeId;
          updateData.geocoded = true;
          updateData.geocodingSource = 'geocode.maps.co';
        }
      }
    }

    const updatedLocation = await Location.findByIdAndUpdate(
      params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return NextResponse.json(updatedLocation);
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    await dbConnect();

    const location = await Location.findOneAndDelete({
      _id: params.id,
      createdBy: session.user.id,
    });

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
