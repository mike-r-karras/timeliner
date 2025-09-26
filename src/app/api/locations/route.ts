import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import { authOptions } from '@/lib/auth';
import { GeocodingService } from '@/lib/geocoding';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const stateProvince = searchParams.get('stateProvince');

    await dbConnect();

    let query: any = { createdBy: session.user.id };

    // Add search filters
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { streetAddress: searchRegex },
        { city: searchRegex },
        { stateProvince: searchRegex },
        { formattedAddress: searchRegex },
      ];
    }

    if (city) {
      query.city = new RegExp(city, 'i');
    }

    if (stateProvince) {
      query.stateProvince = new RegExp(stateProvince, 'i');
    }

    const locations = await Location.find(query)
      .sort({ name: 1, city: 1, stateProvince: 1 });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
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

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    let locationData: any = {
      name: name.trim(),
      streetAddress: streetAddress?.trim(),
      city: city?.trim(),
      stateProvince: stateProvince?.trim(),
      postalCode: postalCode?.trim(),
      country: country?.trim() || 'United States',
      radius: radius || undefined,
      description: description?.trim(),
      createdBy: session.user.id,
      geocoded: false,
    };

    // If coordinates are provided, validate them
    if (latitude !== undefined && longitude !== undefined) {
      if (!GeocodingService.isValidCoordinates(latitude, longitude)) {
        return NextResponse.json(
          { error: 'Invalid latitude or longitude values' },
          { status: 400 }
        );
      }
      locationData.latitude = latitude;
      locationData.longitude = longitude;
      locationData.geocoded = true;
      locationData.geocodingSource = 'manual';
    } else if (geocodeAddress !== false) {
      // Attempt to geocode the address if coordinates not provided
      const addressString = GeocodingService.buildAddressString({
        streetAddress,
        city,
        stateProvince,
        postalCode,
        country: country || 'United States',
      });

      if (addressString) {
        console.log(`Attempting to geocode: ${addressString}`);
        const geocodeResult = await GeocodingService.geocodeAddress(addressString);

        if (geocodeResult) {
          locationData.latitude = geocodeResult.latitude;
          locationData.longitude = geocodeResult.longitude;
          locationData.formattedAddress = geocodeResult.formattedAddress;
          locationData.placeId = geocodeResult.placeId;
          locationData.geocoded = true;
          locationData.geocodingSource = 'geocode.maps.co';

          // Update any missing address components from geocoding
          if (!locationData.streetAddress && geocodeResult.streetAddress) {
            locationData.streetAddress = geocodeResult.streetAddress;
          }
          if (!locationData.city && geocodeResult.city) {
            locationData.city = geocodeResult.city;
          }
          if (!locationData.stateProvince && geocodeResult.stateProvince) {
            locationData.stateProvince = geocodeResult.stateProvince;
          }
          if (!locationData.postalCode && geocodeResult.postalCode) {
            locationData.postalCode = geocodeResult.postalCode;
          }
          if (!locationData.country || locationData.country === 'United States') {
            locationData.country = geocodeResult.country || locationData.country;
          }

          console.log(`Geocoding successful: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
        } else {
          console.log('Geocoding failed, location will be saved without coordinates');
          return NextResponse.json(
            { error: 'Unable to geocode address. Please provide coordinates manually or check the address.' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Either coordinates or a complete address is required for geocoding' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Either coordinates or address information is required' },
        { status: 400 }
      );
    }

    const location = await Location.create(locationData);

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}