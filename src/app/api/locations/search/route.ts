import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GeocodingService } from '@/lib/geocoding';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    if (limit > 10 || limit < 1) {
      return NextResponse.json({ error: 'Limit must be between 1 and 10' }, { status: 400 });
    }

    console.log(`Searching locations for: "${query}"`);

    const results = await GeocodingService.searchLocations(query.trim(), limit);

    return NextResponse.json({
      query: query.trim(),
      results,
      count: results.length,
    });

  } catch (error) {
    console.error('Error searching locations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}