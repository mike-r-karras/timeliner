'use client';

import L from 'leaflet';
import { useMap } from 'react-leaflet/hooks';
import React, { useEffect, useRef } from 'react';

type Props = {
  points: L.LatLngTuple[];
  options?: L.PolylineOptions & { steps?: number; wrap?: boolean };
};

export default function GeodesicPath({ points, options }: Props) {
  const map = useMap();                          // ✅ valid: reads context during render
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map || !points?.length) return;
    let cancelled = false;

    (async () => {
      const { GeodesicLine } = await import('leaflet.geodesic'); // load on client
      if (cancelled) return;

      const line = new GeodesicLine(points, { weight: 2, wrap: true, ...options });
      lineRef.current = line;
      line.addTo(map);
    })();

    return () => {
      cancelled = true;
      lineRef.current?.remove();
      lineRef.current = null;
    };
  }, [map, JSON.stringify(points), JSON.stringify(options)]);

  return null;
}


