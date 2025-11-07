'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Autocomplete,
  Chip,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
  CircularProgress,
  Icon,
  MenuItem,
  Select,
  InputLabel,
  debounce,
  SvgIconProps,
  Slider,
  Tooltip
} from '@mui/material';
import {
  LocationOn,
  Search,
  MyLocation,
  DirectionsCar,
  DirectionsBoat,
  DirectionsBike,
  DirectionsWalk,
  Flight,       // instead of PlaneFilled
  Hiking,
  Label,       // instead of HikingFilled
} from '@mui/icons-material';
import moment, { Moment } from 'moment';
import dynamic from 'next/dynamic';
import { start } from 'repl';
import { set } from 'mongoose';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import GeodesicPath from './GeodesicPath';
import { getIconFromName } from '@/lib/pathHelper';
import GeodesicPoint from './GeodesicPath';
import { haversineDistance, openStreetRoute, slerpLatLng } from '@/utils/geo';
import { useMuiDivIcon, IconName } from '@/hooks/useMuiDivIcon';
import { STORAGE_KEY_PANEL_POSITION_PREFIX } from 'next/dist/next-devtools/dev-overlay/shared';
import { tempoFromDate } from '@/utils/tempo';
import { icon } from 'leaflet';
import * as PL from '@mapbox/polyline';
import path from 'path';
import { time } from 'console';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline),{ ssr: false });

interface PathResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  name?: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

interface PathModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  timelineId: string;
  pathId?: string;
  initialData?: any;
}

interface IStyle {
  color: string,
  rot: number,
  size: number
}

interface PathStyle {
  color: string,
  line: string,
  width: number
}

 export default function PathModal({ 
    open, 
    onClose, 
    onSave, 
    pathId,
    timelineId,
    initialData 
}: PathModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    startStreetAddress: '',
    startCity: '',
    startStateProvince: '',
    startPostalCode: '',
    startCountry: 'United States',
    startLatitude: '',
    startLongitude: '',
    description: '',
    endStreetAddress: '',
    endCity: '',
    endStateProvince: '',
    endPostalCode: '',
    endCountry: 'United States',
    endLatitude: '',
    endLongitude: '',
    startLocationName: '',
    endLocationName: '',
    geocoded: false,
    startTime: null,
    endTime: null,
    routed: false,
    mode: 'straight',
    icon: '',
    style: { color: '', size: null, rot: null },
    pathStyle: { color: '', line: '', width: null },
    duration: null,
    coordinates: null,
    durationSegments: null,
    waypoints: null,
  });

  if (!initialData) {
    initialData = {
      startLocation: null,
      endLocation: null,
    };
  }

  const [autoGeocode, setAutoGeocode] = useState(true);
  const [name, setName] = useState(initialData?.name || '');
  const [routed, setRouted] = useState(initialData?.routed || false);
  const [mode, setMode] = useState(initialData?.mode || 'straight');
  const [startLocationQuery, setStartLocationQuery] = useState('');
  const [endLocationQuery, setEndLocationQuery] = useState('');
  const [startLocationResults, setStartLocationResults] = useState<PathResult[]>([]);
  const [endLocationResults, setEndLocationResults] = useState<PathResult[]>([]);
  const [selectedStartLocation, setSelectedStartLocation] = useState<PathResult | null>(initialData?.startLocation || null);
  const [selectedEndLocation, setSelectedEndLocation] = useState<PathResult | null>(initialData?.endLocation || null);
  const [description, setDescription] = useState(initialData?.description || '');
  const [loadingStartLocation, setLoadingStartLocations] = useState(false);
  const [loadingEndLocation, setLoadingEndLocations] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(initialData?.startTime ? new Date(initialData.startTime) : null);
  const [endTime, setEndTime] = useState<Date | null>(initialData?.endTime ? new Date(initialData.endTime) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [startPickerValue, setStartPickerValue] = useState<Moment | null>(null); // for the picker
  const [endPickerValue, setEndPickerValue] = useState<Moment | null>(null); // for the picker
  const [markerStyle, setMarkerStyle] = useState<Partial<SvgIconProps>>({
    fontSize: 'small',
    htmlColor: 'blue',  // ✅ any CSS color
  });
  const [markerIcon, setMarkerIcon] = useState(getIconFromName('location_on', markerStyle));
  const [linePosition, setLinePosition] = useState(0.5);
  const [routePosition, setRoutePosition] = useState<number[] | null>([]);
  const [duration, setDuration] = useState<number>(0);
  const [gPosition, setGPosition] = useState<number[] | null>(null);
  const [lPosition, setLPosition] = useState<number[] | null>(null);
  const [currDateTime, setCurrDateTime] = useState<Date>(new Date());
  const [iconName, setIconName] = useState<IconName>('location_on');
  const [iconColor, setIconColor] = useState<string>('blue');
  const [iconSize, setIconSize] = useState<number>(32);
  const [iconRot, setIconRot] = useState<number>(0);
  const [pathLine, setPathLine] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [pathColor, setPathColor] = useState<string>('blue');
  const [pathWidth, setPathWidth] = useState<number>(2);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [durationSegments, setDurationSegments] = useState<number[]>([]);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const iconColors = ["blue", "red", "green", "orange", "purple", "yellow", "black", "gray", "pink", "brown", "teal", "cyan", "lime", "indigo", "lightBlue", "lightGreen", "white", "darkGray", "gold", "silver"]
  const leafletIcon = useMuiDivIcon(iconName, iconColor, iconSize, [iconSize/2, iconSize * .75], iconRot);
  
  useEffect(() => {
    const sLat = Number.parseFloat(formData?.startLatitude ?? '');
    const sLng = Number.parseFloat(formData?.startLongitude ?? '');
    const eLat = Number.parseFloat(formData?.startLatitude ?? '');
    const eLng = Number.parseFloat(formData?.startLongitude ?? '');
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng) || !Number.isFinite(eLat) || !Number.isFinite(eLng)) {
      setGPosition(null);
    }
    console.log('Calling slerp with:',
  [formData.startLatitude, formData.startLongitude],
  [formData.endLatitude,   formData.endLongitude],
  linePosition);
    const start: [number, number] = [
  parseFloat(formData.startLatitude),
  parseFloat(formData.startLongitude),
];
const end: [number, number] = [
  parseFloat(formData.endLatitude),
  parseFloat(formData.endLongitude),
];

setCurrDateTime(tempoFromDate(formData.startTime, formData.endTime, linePosition) || new Date());

if (
  start.every(Number.isFinite) &&
  end.every(Number.isFinite) &&
  (Math.abs(start[0] - end[0]) > 1e-9 || Math.abs(start[1] - end[1]) > 1e-9)
) {
  const p = slerpLatLng(start, end, linePosition);
  setGPosition(p);
  const H = start[0] + (end[0] - start[0]) * linePosition;
  const L = start[1] + (end[1] - start[1]) * linePosition;
  setLPosition([H, L]);
} else {
  console.warn('Invalid start/end for slerp', { start, end });
}
}, [formData?.startLatitude, formData?.startLongitude, formData?.endLatitude, formData?.endLongitude, linePosition]);

  //const [gPosition, setGPosition] = useState<[number, number] | null>(null);
  // const [linePosition, setLinePosition] = useState(0.5);

  useEffect(() => {
      setIsClient(true);
  
      // Fix Leaflet marker icons
      if (typeof window !== 'undefined') {
        // Import Leaflet dynamically to avoid SSR issues
        import('leaflet').then((L) => {
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          });
        });
      }
    }, []);

  useEffect(() => {
    if (open) {
        if (initialData) {
            setName(initialData.name || '');
            setRouted(initialData.routed || false);
            setMode(initialData.mode || 'straight');
            setSelectedStartLocation(initialData.startLocation || null);
            setSelectedEndLocation(initialData.endLocation || null);
            setDescription(initialData.description || '');
            setStartTime(initialData.startTime ? new Date(initialData.startTime) : null);
            setEndTime(initialData.endTime ? new Date(initialData.endTime) : null);
            if (initialData.startLocation?.latitude && initialData.startLocation?.longitude && initialData.endLocation?.latitude && initialData.endLocation?.longitude) {
                setGeocoded(true);
            } else {
                setGeocoded(false);
            }
        }
    }
  }, [open, pathId, initialData.startLocation || null, initialData.endLocation || null]);

  useEffect(() => {
    if (startLocationQuery.length < 3) {
      setStartLocationResults([]);
      return;
    }

    const fetchStartLocations = async () => {
      setLoadingStartLocations(true);
      try {
        const response = await fetch(`/api/geocode?query=${encodeURIComponent(startLocationQuery)}`);
        const results = await response.json();
        setStartLocationResults(results);
      } catch (err) {
        console.error('Error fetching start locations:', err);
      } finally {
        setLoadingStartLocations(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchStartLocations();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [startLocationQuery]);

useEffect(() => {
  if (!endLocationQuery?.trim()) {
    setEndLocationResults([]);
    return;
  }

  const controller = new AbortController();

  const fetchEndLocations = async () => {
    setLoadingEndLocations(true);
    try {
      const res = await fetch(
        `/api/geocode?query=${encodeURIComponent(endLocationQuery)}`,
        { signal: controller.signal }
      );
      const results = await res.json();
      setEndLocationResults(results);
    } catch (err) {
      if ((err as any).name !== 'AbortError') {
        console.error('Error fetching end locations:', err);
      }
    } finally {
      setLoadingEndLocations(false);
    }
  };

  const t = setTimeout(fetchEndLocations, 500);

  return () => {
    clearTimeout(t);
    controller.abort();
  };
}, [endLocationQuery]);

useMemo(() => {
  if ((mode == 'straight' || mode == 'flying') && !duration) {
    setRoutePosition([]);
    return
  };
  var durPoint: [number, number];
  var durIndex: number = 0;
  var durPosition = Math.floor(duration * linePosition);
  var curPosition = 0;
  var wayPointCounter = 0;
  while (curPosition<duration) {
    curPosition += durationSegments[durIndex];
    if (curPosition >= durPosition) {
      curPosition -= durationSegments[durIndex];
      wayPointCounter = waypoints[durIndex-1][0];
      durIndex -= 1;
      while(curPosition <= durPosition) {
        curPosition += haversineDistance(routeCoordinates[wayPointCounter], routeCoordinates[wayPointCounter+1]);
        wayPointCounter += 1;
      }
      setRoutePosition(routeCoordinates[wayPointCounter-1]);
      break;
    }
    durIndex += 1;
  }
  }, [routeCoordinates, mode, duration, durationSegments, linePosition]);

function normalizeToPoint(pos: any): [number, number] | null {
  if (!pos) return null;

  // Already a single [lat, lng]
  if (Array.isArray(pos) && pos.length === 2 && typeof pos[0] === 'number') {
    return pos as [number, number];
  }

  // Polyline array: [[lat,lng], ...] -> take first point
  if (Array.isArray(pos) && Array.isArray(pos[0])) {
    return pos.length > 0 ? (pos[0] as [number, number]) : null;
  }

  // {lat, lng} object
  if (typeof pos === 'object' && 'lat' in pos && 'lng' in pos) {
    return [pos.lat as number, pos.lng as number];
  }

  return null;
}


const handleRouteTypeChange = async ( value: string) => {
    setMode(value);
            const response = await fetch('/api/routes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              start: [parseFloat(formData.startLongitude), parseFloat(formData.startLatitude)],
              end: [parseFloat(formData.endLongitude), parseFloat(formData.endLatitude)],
              routeType: value,
        })});
        Promise.resolve(response.json()).then((data) => { 
          console.log('Received route data:', data);
          console.log('Route details:', data.details);
          console.log('Route features:', data.details.routes);
          console.log('Route geometry:', data.details.routes[0].geometry);
        const coords = PL.decode(data.details.routes[0].geometry);
        setDuration(data.details.routes[0].segments[0].duration);
        const durSegs: number[] = data.details.routes[0].segments[0].steps.map((step: any) => step.duration);
        const wPts: number[] = data.details.routes[0].segments[0].steps.map((step: any) => step.way_points);
        setDurationSegments(durSegs);
        setWaypoints(wPts);
        console.log('Decoded coordinates:', coords);
    setRouteCoordinates(coords); }); // convert [lon, lat] to [lat, lon]
};

const handleSave = async () => {
  if (!formData.name?.trim()) {
    setError('Path name is required.');
    return;
  }
  if (!formData.startLatitude || !formData.startLongitude) {
    setError('Start location is required.');
    return;
  }
  if (!formData.endLatitude || !formData.endLongitude) {
    setError('End location is required.');
    return;
  }

if (!formData.startTime || !formData.endTime || !(formData.startTime < formData.endTime)) {
  setError('Start time must be before end time.');
  return;
}

  setLoading(true);
    setError(null);
    try {
        const pathData = {
          timelineId,
          name: formData.name.trim(),
          routed: formData.routed,
          mode: formData.mode,
          icon: formData.icon || undefined,
          startLocationName: formData.startLocationName.trim() || undefined,
          startStreetAddress: formData.startStreetAddress.trim() || undefined,
          startCity: formData.startCity.trim() || undefined,
          startStateProvince: formData.startStateProvince.trim() || undefined,
          startPostalCode: formData.startPostalCode.trim() || undefined,
          startCountry: formData.startCountry.trim() || undefined,
          startLatitude: parseFloat(formData.startLatitude),
          startLongitude: parseFloat(formData.startLongitude),
          endLocationName: formData.endLocationName.trim() || undefined,
          endStreetAddress: formData.endStreetAddress,
          endCity: formData.endCity,
          endStateProvince: formData.endStateProvince,
          endPostalCode: formData.endPostalCode,
          endCountry: formData.endCountry,
          endLatitude: parseFloat(formData.endLatitude),
          endLongitude: parseFloat(formData.endLongitude),
          description: formData.description.trim(),
          startTime: formData.startTime,
          endTime: formData.endTime,
          pathStyle: { pathLine: pathLine, color: pathColor, width: pathWidth },
          style: { color: iconColor, size: iconSize, rot: iconRot },
          duration: duration,
          coordinates: routeCoordinates,
          durationSegments: durationSegments,
          waypoints: waypoints,
        };
        const url = pathId ? `/api/paths/${pathId}` : '/api/paths';
        const method = pathId ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pathData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
    } catch (err) {
        setError('Error preparing path data.');
        setLoading(false);
        return;  
    } finally {
        setLoading(false);
    }
    onSave({
      name: name.trim(),
      routed,
      mode,
      startLocation: selectedStartLocation,
      endLocation: selectedEndLocation,
      startTime: startTime,
      endTime: endTime,
      description: description.trim(),
    });
  };

  useEffect(() => {
    if (formData.icon) {
      setMarkerIcon(getIconFromName(formData.icon, markerStyle));
    } else {
      setMarkerIcon(getIconFromName('location_on', markerStyle));
    }}, [
      formData.icon, 
      markerStyle, 
      formData.startLatitude, 
      formData.startLongitude, 
      formData.endLatitude, 
      formData.endLongitude
    ]);
  
  const handleIconChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFormData(prev => ({
          ...prev,
          icon: event.target.value as string,
    }));
    setIconName(event.target.value as IconName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  }

    const handleLocationSearch = async (searchQuery: string, startOrEnd: string) => {
    if (!searchQuery?.trim() || searchQuery.length < 3) {
      if (startOrEnd === 'start') {
        setStartLocationResults([]);
      } else {
        setEndLocationResults([]);
      }
      return;
    }
    if (startOrEnd === 'start') {
      setLoadingStartLocations(true);
    } else {
      setLoadingEndLocations(true);
    }
    try {
      let response = await fetch(`/api/locations/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
      if (response.ok) {
        let data = await response.json();
        if (data.results.length === 0) {
          response = await fetch('/api/query-location', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              locationName: encodeURIComponent(searchQuery.trim()),
            }),
        });
        data = await response.json();
      }
        if (response.ok) {
          let newPlaces = data.results;
          console.log(`**************************\ninside location search response ok\n**************************`);
            if (data.results?.length > 0) {
                const flags = new Set();
                newPlaces = data.results.filter((entry: { formattedAddress: unknown; }) => {
                  if (flags.has(entry.formattedAddress)) {
                    return false;
                  }
                  flags.add(entry.formattedAddress);
                  return true;
              });
          data.results = newPlaces;
            }
        }

        if (startOrEnd == 'start')
          setStartLocationResults(data.results || []);
        else
          setEndLocationResults(data.results || []);
      } else {
        if (startOrEnd == 'start')
          setStartLocationResults([]);
        else
          setEndLocationResults([]);
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      if (startOrEnd == 'start')
        setStartLocationResults([]);
      else
        setEndLocationResults([]);
    } finally {
      if (startOrEnd === 'start') {
        setLoadingStartLocations(false);
      } else {
        setLoadingEndLocations(false);
      }
    }
  };

const handleGeocodeAddress = async (startOrEnd: string) => {
  let addressComponents: string[];
  if (startOrEnd === 'start') {
  addressComponents = [
      formData.startStreetAddress,
      formData.startCity,
      formData.startStateProvince,
      formData.startPostalCode,
      formData.startCountry,
    ].filter(Boolean);
    } else {
    addressComponents = [
      formData.endStreetAddress,
      formData.endCity,
      formData.endStateProvince,
      formData.endPostalCode,
      formData.endCountry,
    ].filter(Boolean);
  }

    if (addressComponents.length === 0) {
      setError('Please provide address information to geocode');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/locations/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: addressComponents.join(', '),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const result = data.result;
        if (startOrEnd === 'start') {
        setFormData(prev => ({
          ...prev,
          startLatitude: result.latitude.toString(),
          startLongitude: result.longitude.toString(),
          startStreetAddress: result.streetAddress || null,
          city: result.city || null,
          stateProvince: result.stateProvince || null,
          postalCode: result.postalCode || null,
          country: result.country || null,
        }));
        } else {
        setFormData(prev => ({
          ...prev,
          endLatitude: result.latitude.toString(),
          endLongitude: result.longitude.toString(),
          endStreetAddress: result.streetAddress || null,
          endCity: result.city || null,
          endStateProvince: result.stateProvince || null,
          endPostalCode: result.postalCode || null,
          endCountry: result.country || null,
        }));
        }
        setGeocoded(true);
      } else {
        setError(data.error || 'Failed to geocode address');
      }
    } catch (error) {
      setError('Error geocoding address');
    } finally {
      setLoading(false);
    }
  };

const handleGetCurrentLocation = (startOrEnd: string) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFormData(prev => ({
          ...prev,
          startLatitude: lat.toString(),
          startLongitude: lng.toString(),
        }));

        // Try to reverse geocode to fill in address
        try {
          const response = await fetch('/api/locations/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: lat,
              longitude: lng,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const result = data.result;
            if (startOrEnd === 'start') {
            setFormData(prev => ({
              ...prev,
              streetAddress: result.startStreetAddress || prev.startStreetAddress,
              city: result.startCity || prev.startCity,
              stateProvince: result.startStateProvince || prev.startStateProvince,
              postalCode: result.startPostalCode || prev.startPostalCode,
              country: result.startCountry || prev.startCountry,
            }));
            } else {
            setFormData(prev => ({
              ...prev,
              streetAddress: result.endStreetAddress || prev.endStreetAddress,
              city: result.endCity || prev.endCity,
              stateProvince: result.endStateProvince || prev.endStateProvince,
              postalCode: result.endPostalCode || prev.endPostalCode,
              country: result.endCountry || prev.endCountry,
            }));
            }
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
        }

        setGeocoded(true);
        setLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Unable to get current location, checking AI...');

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleLocationSelect = (locationResult: PathResult, startOrEnd: String) => {
    if (startOrEnd === 'start') {
    setFormData(prev => ({
      ...prev,
      startStreetAddress: locationResult.streetAddress || prev.startStreetAddress,
      startCity: locationResult.city || prev.startCity,
      startStateProvince: locationResult.stateProvince || prev.startStateProvince,
      startPostalCode: locationResult.postalCode || prev.startPostalCode,
      startCountry: locationResult.country || prev.startCountry,
      startLatitude: locationResult.latitude.toString(),
      startLongitude: locationResult.longitude.toString(),
    }));
    } else {
    setFormData(prev => ({
      ...prev,
      endStreetAddress: locationResult.streetAddress || prev.endStreetAddress,
      endCity: locationResult.city || prev.endCity,
      endStateProvince: locationResult.stateProvince || prev.endStateProvince,
      endPostalCode: locationResult.postalCode || prev.endPostalCode,
      endCountry: locationResult.country || prev.endCountry,
      endLatitude: locationResult.latitude.toString(),
      endLongitude: locationResult.longitude.toString(),
    }));
    }
    setGeocoded(true);
    setStartLocationResults([]);
  };

  return (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn />
            {pathId ? 'Edit Path' : 'Add New Path'}
          </Box>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
  
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 , overflowY: 'auto', maxHeight: '70vh', pt: 2, pb: 2 }}>
              <TextField
                required
                fullWidth
                label="Path Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Home, Office, Central Park"
              />
  
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Address Information
              </Typography>
  
              <Autocomplete
                freeSolo
                options={startLocationResults}
                loading={loadingStartLocation}
                getOptionLabel={(option) =>
                  typeof option === 'string' ? option : option.formattedAddress
                }
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                  <Box component="li" key={key} {...otherProps} onClick={() => handleLocationSelect(option, 'start')}>
                    <LocationOn sx={{ mr: 1, color: 'action.active' }} />
                    <Box>
                      <Typography variant="body2">{option.formattedAddress}</Typography>
                      {option.city && option.stateProvince && (
                        <Typography variant="caption" color="text.secondary">
                          {option.city}, {option.stateProvince}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search for start address"
                    placeholder="Start typing an address..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                      endAdornment: loadingStartLocation ? <CircularProgress size={20} /> : null,
                    }}
                  />
                )}
                onInputChange={debounce((_, value) => handleLocationSearch(value, 'start'), 1000)}
              />
  
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Start Street Address"
                    value={formData.startStreetAddress}
                    onChange={(e) => setFormData({ ...formData, startStreetAddress: e.target.value })}
                    placeholder="123 Main St"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start City"
                    value={formData.startCity}
                    onChange={(e) => setFormData({ ...formData, startCity: e.target.value })}
                    placeholder="New York"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start State/Province"
                    value={formData.startStateProvince}
                    onChange={(e) => setFormData({ ...formData, startStateProvince: e.target.value })}
                    placeholder="NY"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start Postal Code"
                    value={formData.startPostalCode}
                    onChange={(e) => setFormData({ ...formData, startPostalCode: e.target.value })}
                    placeholder="10001"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start Country"
                    value={formData.startCountry}
                    onChange={(e) => setFormData({ ...formData, startCountry: e.target.value })}
                    placeholder="United States"
                  />
                </Grid>
              </Grid>
  
              <Divider />

<Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
  {/* Left column */}
  <Box sx={{ display: 'flex', flexDirection: 'column', width: '65%' }}>
    <Typography variant="h6">Coordinates</Typography>

    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
      <Button
        variant="outlined"
        startIcon={<MyLocation />}
        onClick={() => handleGetCurrentLocation('start')}
        disabled={loading}
      >
        Use Current Location
      </Button>

      <Button
        variant="outlined"
        startIcon={<Search />}
        onClick={() => handleGeocodeAddress('start')}
        disabled={loading}
      >
        Geocode Address
      </Button>

      {geocoded && (
        <Chip label="Geocoded" color="success" size="small" />
      )}
    </Box>

    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Start Latitude"
          type="number"
          value={formData.startLatitude}
          onChange={(e) => setFormData({ ...formData, startLatitude: e.target.value })}
          placeholder="40.7589"
          inputProps={{ step: 'any', min: -90, max: 90 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Start Longitude"
          type="number"
          value={formData.startLongitude}
          onChange={(e) => setFormData({ ...formData, startLongitude: e.target.value })}
          placeholder="-73.9851"
          inputProps={{ step: 'any', min: -180, max: 180 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DateTimePicker
                label="Start Date & Time"
                value={formData.startTime}
                onChange={(date) => date && setFormData({ ...formData, startTime: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
      </Grid>
    </Grid>
  </Box>

  {/* Right column */}
  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
    {/* Map Preview */}
    {isClient &&
      formData.startLatitude &&
      formData.startLongitude && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Start Path Preview
          </Typography>
          <Box
            sx={{
              height: 300,
              width: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <MapContainer
              center={[
                parseFloat(formData.startLatitude),
                parseFloat(formData.startLongitude),
              ]}
              zoom={15}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <Marker
                position={[
                  parseFloat(formData.startLatitude),
                  parseFloat(formData.startLongitude),
                ]}
              />
            </MapContainer>
          </Box>
        </Box>
    )} {/* <-- note the )} here */}
  </Box>
</Box>

<Divider sx={{ mt: 4, mb: 4 }} />

 <Autocomplete
                freeSolo
                options={endLocationResults}
                loading={loadingEndLocation}
                getOptionLabel={(option) =>
                  typeof option === 'string' ? option : option.formattedAddress
                }
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                  <Box component="li" key={key} {...otherProps} onClick={() => handleLocationSelect(option, 'end')}>
                    <LocationOn sx={{ mr: 1, color: 'action.active' }} />
                    <Box>
                      <Typography variant="body2">{option.formattedAddress}</Typography>
                      {option.city && option.stateProvince && (
                        <Typography variant="caption" color="text.secondary">
                          {option.city}, {option.stateProvince}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search for End address"
                    placeholder="start typing an address..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                      endAdornment: loadingEndLocation ? <CircularProgress size={20} /> : null,
                    }}
                  />
                )}
                onInputChange={debounce((_, value) => handleLocationSearch(value, 'end'), 1000)}
              />
  
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="End Street Address"
                    value={formData.endStreetAddress}
                    onChange={(e) => setFormData({ ...formData, endStreetAddress: e.target.value })}
                    placeholder="123 Main St"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End City"
                    value={formData.endCity}
                    onChange={(e) => setFormData({ ...formData, endCity: e.target.value })}
                    placeholder="New York"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End State/Province"
                    value={formData.endStateProvince}
                    onChange={(e) => setFormData({ ...formData, endStateProvince: e.target.value })}
                    placeholder="NY"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End Postal Code"
                    value={formData.endPostalCode}
                    onChange={(e) => setFormData({ ...formData, endPostalCode: e.target.value })}
                    placeholder="10001"
                  />
                </Grid>
  
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End Country"
                    value={formData.endCountry}
                    onChange={(e) => setFormData({ ...formData, endCountry: e.target.value })}
                    placeholder="United States"
                  />
                </Grid>
              </Grid>
  
              <Divider />

<Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
  {/* Left column */}
  <Box sx={{ display: 'flex', flexDirection: 'column', width: '65%' }}>
    <Typography variant="h6">End Coordinates</Typography>

    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
      <Button
        variant="outlined"
        endIcon={<MyLocation />}
        onClick={() => handleGetCurrentLocation('end')}
        disabled={loading}
      >
        Use Current Location
      </Button>
      <Button
        variant="outlined"
        endIcon={<Search />}
        onClick={() => handleGeocodeAddress('end')}
        disabled={loading}
      >
        Geocode Address
      </Button>

      {geocoded && (
        <Chip label="Geocoded" color="success" size="small" />
      )}
    </Box>

    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="End Latitude"
          type="number"
          value={formData.endLatitude}
          onChange={(e) => setFormData({ ...formData, endLatitude: e.target.value })}
          placeholder="40.7589"
          inputProps={{ step: 'any', min: -90, max: 90 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="End Longitude"
          type="number"
          value={formData.endLongitude}
          onChange={(e) => setFormData({ ...formData, endLongitude: e.target.value })}
          placeholder="-73.9851"
          inputProps={{ step: 'any', min: -180, max: 180 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DateTimePicker
                label="Start Date & Time"
                value={formData.endTime}
                onChange={(date) => date && setFormData({ ...formData, endTime: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
      </Grid>
    </Grid>
  </Box>

  {/* Right column */}
  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
    {/* Map Preview */}
    {isClient &&
      formData.endLatitude &&
      formData.endLongitude && (
        <Box>
          <Typography variant="h6" gutterBottom>
            End Path Preview
          </Typography>
          <Box
            sx={{
              height: 300,
              width: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <MapContainer
              center={[
                parseFloat(formData.endLatitude),
                parseFloat(formData.endLongitude),
              ]}
              zoom={15}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <Marker
                position={[
                  parseFloat(formData.endLatitude),
                  parseFloat(formData.endLongitude),
                ]}
              />
            </MapContainer>
          </Box>
        </Box>
    )} {/* <-- note the )} here too */}
  </Box>
</Box>

<Divider sx={{ mt: 4, mb: 4 }} />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional notes about this location..."
              />
              <Select 
                value={formData.mode} 
                onChange={(e) => {setFormData({ ...formData, mode: e.target.value });
                  handleRouteTypeChange(e.target.value);}}
                fullWidth
                label="Travel Mode"
              >
                <MenuItem value="straight">Straight Line</MenuItem>
                <MenuItem value="driving">Driving Route</MenuItem>
                <MenuItem value="walking">Walking Route</MenuItem>
                <MenuItem value="bicycling">Bicycling Route</MenuItem>
                <MenuItem value="transit">Transit Route</MenuItem>
                <MenuItem value="flying">Flying Route</MenuItem>
                <MenuItem value="sailing">Sailing Route</MenuItem>
                <MenuItem value="horseback">Horseback Riding Route</MenuItem>
                <MenuItem value="geodesic">Geodesic Line</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>

              <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                <Box sx={{flexDirection: 'col', p: 1}}>
                  <InputLabel id="path-line-label"  sx={{fontSize:'small',fontWeight:8}}>Path Line</InputLabel>
                  <Select
                    value={pathLine}
                    onChange={(e) => setPathLine(e.target.value)}
                    autoWidth
                    label="Path Line"
                    labelId='path-line-label'
                  >
                    <MenuItem value="solid">Solid</MenuItem>
                    <MenuItem value="dashed">Dashed</MenuItem>
                    <MenuItem value="dotted">Dotted</MenuItem>
                  </Select>
                </Box>
                <Box sx={{flexDirection: 'col', p: 1}}>
                  <InputLabel id="path-color-label" sx={{fontSize:'small',fontWeight:8}}>Path Color</InputLabel>
                  <Select
                    value={pathColor}
                    onChange={(e) =>  setPathColor(e.target.value)}
                    autoWidth
                    labelId='path-color-label'
                    label="Path Color">
                      { iconColors.map((col) => {
                        return (
                          <MenuItem value={col} key={col}>
                          <Tooltip key={col} title={col} arrow>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: col,
                                border: '1px solid rgba(0,0,0,0.5)',
                              }}
                            />
                          </Tooltip>
                          </MenuItem>
                        );
                      })}
                      </Select>
                </Box>
                <Box sx={{flexDirection: 'col', p: 1}}>
                  <InputLabel id="path-width-label" sx={{fontSize:'small',fontWeight:8}}>Path Width</InputLabel>
                  <Slider
                    value={pathWidth}
                    onChange={(_, value) => setPathWidth(value as number)}
                    sx={{ width: 150 }}
                    min={1}
                    max={10}
                    size="small"
                    step = {1}
                    valueLabelDisplay="on"
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                <Box sx={{flexDirection: 'col', p: 1}}>
              <InputLabel id="path-icon-label"  sx={{fontSize:'small',fontWeight:8}}>Path Icon</InputLabel>
              <Select 
                value={formData.icon}
                onChange={(e) => handleIconChange(e)}
                autoWidth 
                label="Path Icon"
                labelId='path-icon-label'
              >
                <MenuItem value="">None</MenuItem>
<MenuItem value="car"><DirectionsCar fontSize="small" /></MenuItem>
<MenuItem value="bike"><DirectionsBike fontSize="small" /></MenuItem>
<MenuItem value="walk"><DirectionsWalk fontSize="small" /></MenuItem>
<MenuItem value="plane"><Flight fontSize="small" /></MenuItem>
<MenuItem value="boat"><DirectionsBoat fontSize="small" /></MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
              </Box>
              <Box sx={{flexDirection: 'col', alignContent: 'flex-start', p: 1}}>
                <InputLabel id="path-color-label" sx={{fontSize:'small',fontWeight:8}}>Icon Color</InputLabel>
              <Select
                value={iconColor}
                onChange={(e) =>  setIconColor(e.target.value)}
                autoWidth
                labelId='path-color-label'
                label="Icon Color">
                  { iconColors.map((col) => {
                    return (
                      <MenuItem value={col} key={col}>
                      <Tooltip key={col} title={col} arrow>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: col,
                            border: '1px solid rgba(0,0,0,0.5)',
                          }}
                        />
                      </Tooltip>
                      </MenuItem>
                    );
                  })
                }
              </Select>
              </Box>
              <Box sx={{ flexDirection: 'col', p: 1, width: '30%', alignContent: 'flex-start' }}>
                <InputLabel id="path-size-label" sx={{fontSize:'small', p:1}}>Icon Size</InputLabel>
                    <Box sx={{display: 'flex', flexDirection:'row', alignItems: 'center', p:1, flex: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>8</Typography>
                    <Slider
                      defaultValue={iconSize}
                      onChange={(_, value) => setIconSize(value as number)}
                      sx={{ width: '40%' }}
                      min={8}
                      max={64}
                      size="small"
                      step = {1}
                      valueLabelDisplay="on"
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>64</Typography>
                  </Box>
                  </Box>
               <Box sx={{ flexDirection: 'col', p: 1, width: '30%', alignContent: 'flex-start' }}>
                <InputLabel id="path-size-label" sx={{fontSize:'small', p:1}}>Icon Rotation</InputLabel>
                  <Box sx={{display: 'flex', flexDirection: 'row', p: 1, alignContent: 'flex-start', justifyContent:'flex-start'}}>
                    <Typography variant='caption' sx={{ fontSize: '0.7rem'}}>0</Typography>
                    <Slider 
                      value={iconRot}
                      onChange={(_, value) => setIconRot(value)}
                      sx = {{ width: '40%', pt: 2}}
                      min = {0}
                      max = {360}
                      size = "small"
                      step = {5}
                      valueLabelDisplay='on'
                    />
                    <Typography variant='caption' sx={{ fontSize: '0.7rem'}}>360</Typography>
                  </Box>
                  </Box>
                  </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoGeocode}
                    onChange={(e) => setAutoGeocode(e.target.checked)}
                  />
                }
                label="Automatically geocode address if coordinates are not provided"
              />
            </Box>
            <Divider sx={{ mt: 2, mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'row' }}>
    {/* Map Preview */}
    {isClient &&
      formData.endLatitude &&
      formData.endLongitude && 
      formData.startLatitude &&
      formData.startLongitude &&
      (
        <Box sx={{ width: '100%' }}>
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" gutterBottom>
            End Path Preview
          </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <TextField value={`${currDateTime}`} InputProps={{ readOnly: true }} size="small" sx={{ width: '300px' }}/>
          </Box>
          </Box>
          <Box
            sx={{
              height: 300,
              width: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >{formData.startTime && formData.endTime && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{formData.startTime ? moment(formData.startTime).format('YYYY-MM-DD HH:mm:ss') : '—'}</Typography>
                    <Slider
                      defaultValue={0.5}
                      onChange={(_, value) => setLinePosition(value as number)}
                      sx={{ flex: 1 }}
                      min={0}
                      max={1}
                      size="small"
                      step = {0.01}
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{formData.endTime ? moment(formData.endTime).format('YYYY-MM-DD HH:mm:ss') : '—'}</Typography>
                  </Box>
          )}
            <MapContainer
              bounds={[
                [parseFloat(formData.startLatitude),
                parseFloat(formData.startLongitude)],
                [parseFloat(formData.endLatitude),
                parseFloat(formData.endLongitude)]
              ]}
              style={{ width: '100%', height: '100%' }}
            
            >
                <CircleMarker
                    center={[parseFloat(formData.startLatitude), parseFloat(formData.startLongitude)]}
                    radius={5}
                    pathOptions={{
                      fillColor: pathColor, // Blue for entities
                      fillOpacity: 0.8,
                      color: '#FFFFFF', // Yellow border when selected
                      weight: 2,
                      stroke: true,
                    }} />
                <CircleMarker
                    center={[parseFloat(formData.endLatitude), parseFloat(formData.endLongitude)]}
                    radius={5}
                    pathOptions={{
                      fillColor: pathColor, // Blue for entities
                      fillOpacity: 0.8,
                      color: '#FFFFFF', // Yellow border when selected
                      weight: 2,
                      stroke: true,
                    }} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              { formData.mode === 'flying' && (
              <GeodesicPath
  points={[
    [parseFloat(formData.startLatitude), parseFloat(formData.startLongitude)],
    [parseFloat(formData.endLatitude),   parseFloat(formData.endLongitude)],
  ]}
  options={{ weight: pathWidth, color: pathColor, dashArray: pathLine === 'solid' ? null : pathLine === 'dashed' ? '10,10' : '2,6' }}
/>
      )}
      { formData.mode == 'straight' && (
              <Polyline
                positions={[
                  [parseFloat(formData.startLatitude), parseFloat(formData.startLongitude)],
                  [parseFloat(formData.endLatitude),   parseFloat(formData.endLongitude)],
                ]}
                pathOptions={{ weight: pathWidth, color: pathColor, dashArray: pathLine === 'solid' ? null : pathLine === 'dashed' ? '10,10' : '2,6' }}
              />
      )}
      { (formData.mode == 'driving' || formData.mode == 'walking' || formData.mode == 'bicycling' || formData.mode == 'transit') && ( 
        <Polyline
          key={`${formData.startLatitude}-${formData.startLongitude}-${formData.endLatitude}-${formData.endLongitude}-${formData.mode}`} // forces update when coordinates or mode change
          positions={routeCoordinates}
          pathOptions={{ weight: pathWidth, color: pathColor, dashArray: pathLine === 'solid' ? null : pathLine === 'dashed' ? '10,10' : '2,6' }} 
        />
      )}
      {
  (() => {
    const point = normalizeToPoint(routePosition);
    return (
      point &&
      leafletIcon &&
      formData.mode !== 'flying' &&
      formData.mode !== 'straight' && (
        <Marker
          key={`route-marker-${mode}-${iconName}-${iconColor}-${iconSize}-${iconRot}`}
          position={point}
          icon={leafletIcon}
        />
      )
    );
  })()
}

  {formData.icon && gPosition && leafletIcon && formData.mode == 'flying' ? (
    <Marker
      key={`${iconName}-${iconColor}-${iconSize}-${iconRot}`} // forces update cleanly
      position={gPosition}
      icon={leafletIcon}
      rotationAngle={iconRot}
    />
  ) : null }
 { formData.icon && gPosition && leafletIcon && formData.mode == 'straight' ? (
    <Marker
      key={`${iconName}-${iconColor}-${iconSize}-${iconRot}`} // forces update cleanly
      position={lPosition}
      icon={leafletIcon}
      rotationAngle={iconRot}
    />
  ) : null }
              </MapContainer>
          </Box>
        </Box>
      )} {/* <-- note the )} here too */}
  </Box>
          </DialogContent>
  
          <DialogActions>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading ? 'Saving...' : pathId ? 'Update Path' : 'Create Path'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
}