// at top of the file
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import ReactDOMServer from 'react-dom/server';
import { LocationOn } from '@mui/icons-material';

// load react-leaflet bits client-side
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import('react-leaflet').then(m => m.Marker),       { ssr: false });

export default function useMuiDivIcon({ color = 'blue', size = 32 } = {}) {
  const [icon, setIcon] = useState<any>(null);

  // SVG only (safe on server too)
  const svg = useMemo(
    () => ReactDOMServer.renderToStaticMarkup(
      <LocationOn fontSize="inherit" htmlColor="currentColor" />
    ),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import('leaflet');                 // ✅ loads only on client
      const L = leaflet.default ?? (leaflet as any);

      const divIcon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;color:${color}">${svg}</div>`,
        className: 'mui-divicon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });

      if (!cancelled) setIcon(divIcon);
    })();
    return () => { cancelled = true; };
  }, [svg, color, size]);

  return icon; // null until ready
}