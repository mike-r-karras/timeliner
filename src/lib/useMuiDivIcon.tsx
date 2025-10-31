// at top of the file
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import ReactDOMServer from 'react-dom/server';
import { LocationOn } from '@mui/icons-material';
import { DirectionsCar, DirectionsBike, DirectionsWalk, DirectionsBoat, Flight, Hiking, Label, MyLocation, Search } from '@mui/icons-material';
import type { SvgIconProps } from '@mui/material/SvgIcon';

type Icons =
  | 'car'
  | 'bike'
  | 'walk'
  | 'plane'
  | 'boat'
  | 'hike'
  | 'label'
  | 'current_location'
  | 'search'
  | 'location_on';

// Map to component *types*:
const ICON_COMPONENTS: Record<Icons, React.ElementType<SvgIconProps>> = {
  car: DirectionsCar,
  bike: DirectionsBike,
  walk: DirectionsWalk,
  plane: Flight,
  boat: DirectionsBoat,
  hike: Hiking,
  label: Label,
  current_location: MyLocation,
  search: Search,
  location_on: LocationOn,
};

// load react-leaflet bits client-side
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import('react-leaflet').then(m => m.Marker),       { ssr: false });

export default async function useMuiDivIcon(selectedIcon: string, { color = 'blue', size = 32 } = {}) {
  // SVG only (safe on server too)
//  const svg = useMemo(
//    () => {
        const Comp = ICON_COMPONENTS[selectedIcon as Icons] ?? LocationOn;
        ReactDOMServer.renderToStaticMarkup(
      <Comp fontSize="inherit" htmlColor={color} />
//    )},
//    []
  );
  let divIcon: L.DivIcon | null = null;
 // useEffect(() => {
    let cancelled = false;
    async () => {
      const leaflet = await import('leaflet');                 // ✅ loads only on client
      const L = leaflet.default ?? (leaflet as any);

      divIcon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">${svg}</div>`,
        className: 'mui-divicon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });

      // if (!cancelled) setIcon(divIcon);
    };
  //  return () => { cancelled = true; };
  // }, [svg, color, size]);
  console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  console.log('Created divIcon:', divIcon);
  console.log('Color:', color, 'Size:', size);
  console.log('Selected Icon:', selectedIcon);
  console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  return divIcon; // null until ready
}