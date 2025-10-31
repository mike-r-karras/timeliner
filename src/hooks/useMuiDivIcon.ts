'use client';

import React, { useMemo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import ReactDOMServer from 'react-dom/server';
import type * as LType from 'leaflet';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import {
  LocationOn, DirectionsCar, DirectionsBike, DirectionsWalk, Flight, DirectionsBoat, Hiking, Label, MyLocation
} from '@mui/icons-material';

const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });

export type IconName = 'location_on' | 'car' | 'bike' | 'walk' | 'plane' | 'boat' | 'hike' | 'label' | 'current_location';
const ICONS: Record<IconName, React.ElementType<SvgIconProps>> = {
  location_on: LocationOn,
  car: DirectionsCar,
  bike: DirectionsBike,
  walk: DirectionsWalk,
  plane: Flight,
  boat: DirectionsBoat,
  hike: Hiking,
  label: Label,
  current_location: MyLocation,
};

// Hook: returns a real L.DivIcon that updates when deps change
export function useMuiDivIcon(iconName: IconName, color: string = 'tomato', size = 32, iconAnchor: [number, number] = [size/2, size*.75], iconRot = 0) {
  const IconComp = ICONS[iconName];
  const [leafletIcon, setLeafletIcon] = useState<LType.DivIcon | null>(null);
  const rotation = `${iconRot}deg`;
  // Render SVG once per (iconName)
  const svg = useMemo(
    () => ReactDOMServer.renderToStaticMarkup(
      React.createElement(IconComp, { fontSize:"inherit", fill:color }) ),  
    [iconName, color, size, iconAnchor, iconRot]
  );

console.log(`MuiDivIcon: ${iconName} ${color} ${iconAnchor} ${rotation} ${svg} `);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import('leaflet'); // client-only
      const L = (leaflet.default ?? leaflet) as typeof LType;

      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;rotate:${rotation}">${svg}</div>`,
        className: 'mui-divicon',
        iconSize: [size, size],
        iconAnchor,
      });
      if (!cancelled) setLeafletIcon(icon);
    })();
    return () => { cancelled = true; };
  }, [svg, color, size, iconAnchor[0], iconAnchor[1], iconRot]);

  return leafletIcon;
}
