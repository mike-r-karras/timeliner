// src/app/api/routes/route.ts
import { NextResponse } from 'next/server';

type LngLat = [number, number]; // ORS expects [lon, lat] (NOT [lat, lon])

function isLngLat(v: unknown): v is LngLat {
  return Array.isArray(v)
    && v.length === 2
    && typeof v[0] === 'number'
    && typeof v[1] === 'number'
    && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}

function safeJSON<T = unknown>(text: string): T | { raw: string } {
  try { return JSON.parse(text) as T; } catch { return { raw: text }; }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ORS_API_KEY' }, { status: 500 });
    }

    const body = await req.json().catch(() => null) as {
      start?: unknown;
      end?: unknown;
      profile?: string; // e.g., 'driving-car', 'foot-walking', etc.
      // optional extra ORS params (avoid dumping arbitrary values blindly)
      preference?: 'fastest' | 'shortest' | 'recommended';
      avoid_features?: string[];
    } | null;

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const profile = body.profile ?? 'driving-car';
    const { start, end } = body;

    // VALIDATE: must be [lon, lat] and numbers
    if (!isLngLat(start) || !isLngLat(end)) {
      return NextResponse.json(
        { error: 'start/end must be [lon, lat] numbers (ORS requires [lon, lat])' },
        { status: 400 }
      );
    }

    const orsUrl = `https://api.openrouteservice.org/v2/directions/${profile}`;

    const payload: any = {
      coordinates: [start, end], // [[lon,lat],[lon,lat]]
    };

    if (body.preference) payload.preference = body.preference;
    if (body.avoid_features) payload.avoid_features = body.avoid_features;

    const orsRes = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      // Keep it simple; do not forward cookies/headers to ORS
    });

    const text = await orsRes.text();

    if (!orsRes.ok) {
      // Surface the exact error coming from ORS so you can debug
      return NextResponse.json(
        {
          error: 'OpenRouteService error',
          status: orsRes.status,
          details: safeJSON(text),
          sent: payload,
          profile,
        },
        { status: orsRes.status }
      );
    }

    const data = safeJSON(text);
    const geometry = (data as any)?.features?.[0]?.geometry;
    if (!geometry) {
      return NextResponse.json(
        { body: 'Invalid route data from ORS', details: data },
        { status: 200 }
      );
    }
    return NextResponse.json(data, { status: 200 });

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Route handler failed', message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
