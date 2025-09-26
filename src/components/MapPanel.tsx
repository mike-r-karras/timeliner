'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, IconButton, Tooltip, Fab } from '@mui/material';
import { Add, MyLocation, Search } from '@mui/icons-material';
import dynamic from 'next/dynamic';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false });

interface SelectedItems {
  events: string[];
  entities: string[];
  locations: string[];
}

interface Event {
  _id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  importance: number;
  thumbnailUrl?: string;
  locationId?: {
    _id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    streetAddress?: string;
    city?: string;
    stateProvince?: string;
  };
}

interface Location {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius?: number;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  description?: string;
}

interface MapPanelProps {
  timelineId?: string | null;
  selectedItems?: SelectedItems;
  onSelection?: (type: 'event' | 'entity' | 'location', ids: string[], append?: boolean) => void;
  onAddLocation?: (lat: number, lng: number) => void;
  refreshTrigger?: number;
}

export default function MapPanel({ timelineId, selectedItems, onSelection, onAddLocation, refreshTrigger }: MapPanelProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7589, -73.9851]); // NYC default
  const [mapZoom, setMapZoom] = useState(10);
  const [addingLocation, setAddingLocation] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (timelineId) {
      fetchMapData();
    }
  }, [timelineId, refreshTrigger]);

  useEffect(() => {
    // Update map view when events or selections change
    if (events.length > 0) {
      updateMapBounds();
    }
  }, [events, selectedItems?.events]);

  useEffect(() => {
    // Update map view when center/zoom changes
    if (mapRef.current) {
      mapRef.current.setView(mapCenter, mapZoom);
    }
  }, [mapCenter, mapZoom]);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      const [eventsResponse, locationsResponse] = await Promise.all([
        fetch(`/api/events?timelineId=${timelineId}`),
        fetch('/api/locations')
      ]);

      if (eventsResponse.ok) {
        const eventData = await eventsResponse.json();
        setEvents(eventData);
      }

      if (locationsResponse.ok) {
        const locationData = await locationsResponse.json();
        setLocations(locationData);
      }
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMapBounds = () => {
    // Prioritize selected events, then fall back to all events
    const selectedEventIds = selectedItems?.events || [];
    let eventsToShow = events.filter(event => event.locationId?.latitude && event.locationId?.longitude);

    if (selectedEventIds.length > 0) {
      // Filter to only selected events that have locations
      eventsToShow = eventsToShow.filter(event => selectedEventIds.includes(event._id));
    }

    if (eventsToShow.length === 0) {
      // If no selected events with locations, fall back to all events with locations
      eventsToShow = events.filter(event => event.locationId?.latitude && event.locationId?.longitude);
    }

    if (eventsToShow.length === 0) return;

    if (eventsToShow.length === 1) {
      const event = eventsToShow[0];
      setMapCenter([event.locationId!.latitude, event.locationId!.longitude]);
      setMapZoom(14);
    } else {
      // Calculate bounds to fit all events
      const latitudes = eventsToShow.map(event => event.locationId!.latitude);
      const longitudes = eventsToShow.map(event => event.locationId!.longitude);

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      setMapCenter([centerLat, centerLng]);

      // Calculate zoom level based on bounds with padding
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      const maxDiff = Math.max(latDiff, lngDiff);

      let zoom = 10;
      if (maxDiff < 0.005) zoom = 16;
      else if (maxDiff < 0.01) zoom = 15;
      else if (maxDiff < 0.05) zoom = 13;
      else if (maxDiff < 0.1) zoom = 12;
      else if (maxDiff < 0.5) zoom = 10;
      else if (maxDiff < 1) zoom = 9;
      else if (maxDiff < 5) zoom = 7;
      else if (maxDiff < 10) zoom = 6;
      else zoom = 4;

      setMapZoom(zoom);
    }
  };

  const handleEventMarkerClick = (eventId: string, shiftKey: boolean) => {
    if (onSelection) {
      onSelection('event', [eventId], shiftKey);
    }
  };

  const handleLocationMarkerClick = (locationId: string, shiftKey: boolean) => {
    if (onSelection) {
      onSelection('location', [locationId], shiftKey);
    }
  };

  const handleMapClick = (e: any) => {
    if (addingLocation && onAddLocation) {
      const { lat, lng } = e.latlng;
      onAddLocation(lat, lng);
      setAddingLocation(false);
    }
  };

  const handleCenterToCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(12);
      },
      (error) => {
        console.error('Error getting current location:', error);
      }
    );
  };

  const isEventSelected = (eventId: string) => {
    return selectedItems?.events?.includes(eventId) || false;
  };

  const isLocationSelected = (locationId: string) => {
    return selectedItems?.locations?.includes(locationId) || false;
  };

  const getImportanceColor = (importance: number) => {
    switch (importance) {
      case 1: return '#9E9E9E'; // Grey
      case 2: return '#2196F3'; // Blue
      case 3: return '#FF9800'; // Orange
      case 4: return '#F44336'; // Red
      case 5: return '#9C27B0'; // Purple
      default: return '#2196F3';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Map Controls */}
      <Box sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}>
        <Tooltip title="Center to current location">
          <IconButton
            size="small"
            onClick={handleCenterToCurrentLocation}
            sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
          >
            <MyLocation />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Add Location FAB */}
      <Tooltip title={addingLocation ? "Click on map to add location" : "Add location to map"}>
        <Fab
          size="small"
          color={addingLocation ? "secondary" : "primary"}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
          onClick={() => setAddingLocation(!addingLocation)}
        >
          <Add />
        </Fab>
      </Tooltip>

      {/* Map Container */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {isClient ? (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%' }}
            ref={mapRef}
            onClick={handleMapClick}
          >
          {/* OpenStreetMap Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Event Markers */}
          {events
            .filter(event => event.locationId?.latitude && event.locationId?.longitude)
            .map((event) => {
              const location = event.locationId!;
              const isSelected = isEventSelected(event._id);

              return (
                <React.Fragment key={`event-${event._id}`}>
                  {/* Add pulsing outer rings for selected events */}
                  {isSelected && (
                    <>
                      <CircleMarker
                        center={[location.latitude, location.longitude]}
                        radius={24}
                        pathOptions={{
                          fillColor: getImportanceColor(event.importance),
                          fillOpacity: 0.1,
                          color: getImportanceColor(event.importance),
                          weight: 1,
                          stroke: true,
                        }}
                      />
                      <CircleMarker
                        center={[location.latitude, location.longitude]}
                        radius={18}
                        pathOptions={{
                          fillColor: getImportanceColor(event.importance),
                          fillOpacity: 0.2,
                          color: getImportanceColor(event.importance),
                          weight: 1,
                          stroke: true,
                        }}
                      />
                    </>
                  )}

                  {/* Main event marker */}
                  <CircleMarker
                    center={[location.latitude, location.longitude]}
                    radius={isSelected ? 12 : 8}
                    pathOptions={{
                      fillColor: getImportanceColor(event.importance),
                      fillOpacity: isSelected ? 0.9 : 0.7,
                      color: isSelected ? '#ffffff' : getImportanceColor(event.importance),
                      weight: isSelected ? 3 : 2,
                      stroke: true,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        handleEventMarkerClick(event._id, e.originalEvent.shiftKey);
                      },
                    }}
                  >
                    <Popup>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: isSelected ? 'primary.main' : 'inherit' }}>
                          {event.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {location.name}
                        </Typography>
                        {location.streetAddress && (
                          <Typography variant="caption" display="block">
                            {location.streetAddress}
                            {location.city && `, ${location.city}`}
                            {location.stateProvince && `, ${location.stateProvince}`}
                          </Typography>
                        )}
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          {new Date(event.startDateTime).toLocaleDateString()}
                        </Typography>
                        {isSelected && (
                          <Typography variant="caption" display="block" sx={{ mt: 1, color: 'primary.main', fontWeight: 'bold' }}>
                            ● Selected Event
                          </Typography>
                        )}
                      </Box>
                    </Popup>
                  </CircleMarker>

                  {/* Event location radius circle */}
                  {location.radius && (
                    <Circle
                      center={[location.latitude, location.longitude]}
                      radius={location.radius}
                      pathOptions={{
                        fillColor: getImportanceColor(event.importance),
                        fillOpacity: isSelected ? 0.3 : 0.1,
                        color: getImportanceColor(event.importance),
                        weight: isSelected ? 3 : 1,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}

          {/* Standalone Location Markers */}
          {locations
            .filter(location => location.latitude && location.longitude)
            .filter(location => !events.some(event => event.locationId?._id === location._id))
            .map((location) => {
              const isSelected = isLocationSelected(location._id);

              return (
                <React.Fragment key={`location-${location._id}`}>
                  <Marker
                    position={[location.latitude, location.longitude]}
                    eventHandlers={{
                      click: (e) => {
                        handleLocationMarkerClick(location._id, e.originalEvent.shiftKey);
                      },
                    }}
                  >
                    <Popup>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {location.name}
                        </Typography>
                        {location.streetAddress && (
                          <Typography variant="body2">
                            {location.streetAddress}
                          </Typography>
                        )}
                        {location.city && location.stateProvince && (
                          <Typography variant="body2">
                            {location.city}, {location.stateProvince}
                          </Typography>
                        )}
                        {location.description && (
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            {location.description}
                          </Typography>
                        )}
                      </Box>
                    </Popup>
                  </Marker>

                  {/* Location radius circle */}
                  {location.radius && (
                    <Circle
                      center={[location.latitude, location.longitude]}
                      radius={location.radius}
                      pathOptions={{
                        fillColor: '#2196F3',
                        fillOpacity: isSelected ? 0.3 : 0.1,
                        color: '#2196F3',
                        weight: isSelected ? 3 : 1,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>
        ) : (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            backgroundColor: 'grey.100',
            color: 'text.secondary'
          }}>
            <Typography>Loading map...</Typography>
          </Box>
        )}
      </Box>

      {/* Instructions */}
      {addingLocation && (
        <Box sx={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'background.paper',
          p: 1,
          borderRadius: 1,
          boxShadow: 2,
          zIndex: 1000
        }}>
          <Typography variant="caption" color="primary">
            Click on the map to add a new location
          </Typography>
        </Box>
      )}
    </Box>
  );
}