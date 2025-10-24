import React, { createElement } from 'react';
import {
  LocationOn,
  Search,
  MyLocation,
  DirectionsCar,
  DirectionsBoat,
  DirectionsBike,
  DirectionsWalk,
  Flight,
  Hiking,
  Label,
} from '@mui/icons-material';
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

export const getIconFromName = (
  iconName: string,
  iconProps: Partial<SvgIconProps> = {}
) => {
  const Comp = ICON_COMPONENTS[iconName as Icons] ?? LocationOn;
  return createElement(Comp, iconProps);
};

export const GeodesicPoint = ({ points: [], options: {}, position: number }) =>{
    const { GeodesicLine } = import('leaflet.geodesic');
    const line = new GeodesicLine(points, {
        weight: 2,
        steps: 256,
        wrap: true,
        ...options,
      });
    console.log('Geodesic line points:', line.getLatLngs());
    const pointSource = line.getLatLngs() as L.LatLng[];
    const pointIndex = Math.floor(pointSource.length * position);
    line.remove();
    return pointSource[pointIndex];
}