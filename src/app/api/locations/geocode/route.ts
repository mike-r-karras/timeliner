import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GeocodingService } from '@/lib/geocoding';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, latitude, longitude } = await request.json();

    if (address) {
      // Forward geocoding - address to coordinates
      if (!address.trim()) {
        return NextResponse.json({ error: 'Address is required' }, { status: 400 });
      }

      console.log(`Geocoding address: "${address}"`);
      const result = await GeocodingService.geocodeAddress(address.trim());

      if (!result) {
        return NextResponse.json({
          error: 'Unable to geocode the provided address',
          address: address.trim()
        }, { status: 404 });
      }

      return NextResponse.json({
        type: 'forward',
        input: address.trim(),
        result,
      });

    } else if (latitude !== undefined && longitude !== undefined) {
      // Reverse geocoding - coordinates to address
      if (!GeocodingService.isValidCoordinates(latitude, longitude)) {
        return NextResponse.json({
          error: 'Invalid latitude or longitude values',
          latitude,
          longitude
        }, { status: 400 });
      }

      console.log(`Reverse geocoding: ${latitude}, ${longitude}`);
      const result = await GeocodingService.reverseGeocode(latitude, longitude);

      if (!result) {
        return NextResponse.json({
          error: 'Unable to reverse geocode the provided coordinates',
          latitude,
          longitude
        }, { status: 404 });
      }

      return NextResponse.json({
        type: 'reverse',
        input: { latitude, longitude },
        result,
      });

    } else {
      return NextResponse.json({
        error: 'Either address or coordinates (latitude and longitude) are required'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in geocoding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}