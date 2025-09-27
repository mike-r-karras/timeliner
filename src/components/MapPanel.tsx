'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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

interface Entity {
  _id: string;
  name: string;
  type: 'person' | 'organization' | 'place' | 'object' | 'concept' | 'other';
  description?: string;
  importance: number;
  locationId?: {
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
  filteredEntityIds?: string[];
}

export default function MapPanel({ timelineId, selectedItems, onSelection, onAddLocation, refreshTrigger, filteredEntityIds }: MapPanelProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]); // Geographic center of US default
  const [mapZoom, setMapZoom] = useState(10);
  const [addingLocation, setAddingLocation] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<any>(null);

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
    if (timelineId) {
      fetchMapData();
    }
  }, [timelineId, refreshTrigger]);

  // Calculate map bounds with useMemo to prevent infinite loops
  const mapBounds = useMemo(() => {
    console.log('=== MapBounds calculation triggered ===');
    console.log('Events count:', events.length, 'Entities count:', entities.length);
    console.log('Events data:', events.slice(0, 2)); // Show first 2 events
    console.log('Entities data:', entities.slice(0, 2)); // Show first 2 entities
    console.log('Selected items:', selectedItems);
    console.log('Filtered entity IDs:', filteredEntityIds);

    if (events.length === 0 && entities.length === 0) {
      console.log('No events or entities, returning null');
      return null;
    }

    const selectedEventIds = selectedItems?.events || [];
    const selectedEntityIds = selectedItems?.entities || [];
    console.log('Selected items - events:', selectedEventIds, 'entities:', selectedEntityIds);

    // Get items with locations (validate coordinates are valid numbers)
    let eventsToShow = events.filter(event => {
      const loc = event.locationId;
      return loc &&
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number' &&
        !isNaN(loc.latitude) &&
        !isNaN(loc.longitude) &&
        Math.abs(loc.latitude) <= 90 &&
        Math.abs(loc.longitude) <= 180;
    });
    let entitiesToShow = entities.filter(entity => {
      const loc = entity.locationId;
      return entity.type === 'place' && loc &&
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number' &&
        !isNaN(loc.latitude) &&
        !isNaN(loc.longitude) &&
        Math.abs(loc.latitude) <= 90 &&
        Math.abs(loc.longitude) <= 180;
    });

    console.log('Items with locations - events:', eventsToShow.length, 'entities:', entitiesToShow.length);

    // Apply entity filter if provided
    if (filteredEntityIds && filteredEntityIds.length > 0) {
      console.log('Applying entity filter:', filteredEntityIds);
      entitiesToShow = entitiesToShow.filter(entity => filteredEntityIds.includes(entity._id));
      console.log('After entity filter - entities:', entitiesToShow.length);
    }

    // Filter by selections if any items are selected
    if (selectedEventIds.length > 0) {
      eventsToShow = eventsToShow.filter(event => selectedEventIds.includes(event._id));
    }
    if (selectedEntityIds.length > 0) {
      entitiesToShow = entitiesToShow.filter(entity => selectedEntityIds.includes(entity._id));
    }

    // Combine all locations for bounds calculation
    const allLocations = [
      ...eventsToShow.map(event => event.locationId!),
      ...entitiesToShow.map(entity => entity.locationId!)
    ];

    console.log('All locations for bounds:', allLocations.map(loc => ({ name: loc.name, lat: loc.latitude, lng: loc.longitude })));

    if (allLocations.length === 0) {
      console.log('No locations found, returning null');
      return null;
    }

    if (allLocations.length === 1) {
      console.log('Single location found:', allLocations[0].name, 'at', allLocations[0].latitude, allLocations[0].longitude);
      return {
        center: [allLocations[0].latitude, allLocations[0].longitude] as [number, number],
        zoom: 15
      };
    }

    // Calculate bounds
    const lats = allLocations.map(loc => loc.latitude);
    const lngs = allLocations.map(loc => loc.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    console.log('Calculated bounds:', { minLat, maxLat, minLng, maxLng });
    console.log('Calculated center:', { centerLat, centerLng });

    // Calculate zoom level based on bounds with padding
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoom = 10;
    if (maxDiff < 0.01) zoom = 15;
    else if (maxDiff < 0.05) zoom = 13;
    else if (maxDiff < 0.1) zoom = 12;
    else if (maxDiff < 0.5) zoom = 10;
    else if (maxDiff < 1) zoom = 9;
    else zoom = 8;

    console.log('Final map bounds result:', { center: [centerLat, centerLng], zoom });

    return {
      center: [centerLat, centerLng] as [number, number],
      zoom
    };
  }, [events, entities, selectedItems?.events, selectedItems?.entities, filteredEntityIds]);

  // Update map when bounds change
  useEffect(() => {
    if (mapBounds && mapRef.current) {
      console.log('Updating map bounds to:', mapBounds.center, 'zoom:', mapBounds.zoom);
      setMapCenter(mapBounds.center);
      setMapZoom(mapBounds.zoom);
    } else if (events.length > 0 || entities.length > 0) {
      console.log('No map bounds calculated, staying at current position:', mapCenter);

      // As a fallback, try to center on the first available location
      const firstEventWithLocation = events.find(event => {
        const loc = event.locationId;
        return loc &&
          typeof loc.latitude === 'number' &&
          typeof loc.longitude === 'number' &&
          !isNaN(loc.latitude) &&
          !isNaN(loc.longitude) &&
          Math.abs(loc.latitude) <= 90 &&
          Math.abs(loc.longitude) <= 180;
      });
      const firstEntityWithLocation = entities.find(entity => {
        const loc = entity.locationId;
        return entity.type === 'place' && loc &&
          typeof loc.latitude === 'number' &&
          typeof loc.longitude === 'number' &&
          !isNaN(loc.latitude) &&
          !isNaN(loc.longitude) &&
          Math.abs(loc.latitude) <= 90 &&
          Math.abs(loc.longitude) <= 180;
      });

      const fallbackLocation = firstEventWithLocation?.locationId || firstEntityWithLocation?.locationId;
      if (fallbackLocation && mapRef.current) {
        console.log('Using fallback location:', fallbackLocation.name, 'at', fallbackLocation.latitude, fallbackLocation.longitude);
        const fallbackCenter: [number, number] = [fallbackLocation.latitude, fallbackLocation.longitude];
        setMapCenter(fallbackCenter);
        setMapZoom(12);
      }
    }
  }, [mapBounds, events, entities, mapCenter]);

  useEffect(() => {
    // Update map view when center/zoom changes
    if (mapRef.current) {
      mapRef.current.setView(mapCenter, mapZoom);
    }
  }, [mapCenter, mapZoom]);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      console.log('Fetching map data for timelineId:', timelineId);
      const [eventsResponse, entitiesResponse, locationsResponse] = await Promise.all([
        fetch(`/api/events?timelineId=${timelineId}`),
        fetch(`/api/entities?timelineId=${timelineId}`),
        fetch('/api/locations')
      ]);

      if (eventsResponse.ok) {
        const eventData = await eventsResponse.json();
        console.log('Fetched events:', eventData.length, 'events');
        console.log('Sample event:', eventData[0]);
        setEvents(eventData);
      } else {
        console.error('Failed to fetch events:', eventsResponse.status, eventsResponse.statusText);
      }

      if (entitiesResponse.ok) {
        const entityData = await entitiesResponse.json();
        console.log('Fetched entities:', entityData.length, 'entities');
        console.log('Sample entity:', entityData[0]);
        setEntities(entityData);
      } else {
        console.error('Failed to fetch entities:', entitiesResponse.status, entitiesResponse.statusText);
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

  const isEntitySelected = (entityId: string) => {
    return selectedItems?.entities?.includes(entityId) || false;
  };

  const isLocationSelected = (locationId: string) => {
    return selectedItems?.locations?.includes(locationId) || false;
  };

  const handleEntityMarkerClick = (entityId: string, shiftKey: boolean) => {
    if (onSelection) {
      onSelection('entity', [entityId], shiftKey);
    }
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }} suppressHydrationWarning>
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
      <Box sx={{ flex: 1, minHeight: 0 }} suppressHydrationWarning>
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

          {/* Place Entity Markers */}
          {entities
            .filter(entity =>
              entity.type === 'place' &&
              entity.locationId?.latitude &&
              entity.locationId?.longitude &&
              (!filteredEntityIds || filteredEntityIds.length === 0 || filteredEntityIds.includes(entity._id))
            )
            .map((entity) => {
              const location = entity.locationId!;
              const isSelected = isEntitySelected(entity._id);

              return (
                <React.Fragment key={`entity-${entity._id}`}>
                  {/* Add pulsing outer ring for selected entities */}
                  {isSelected && (
                    <CircleMarker
                      center={[location.latitude, location.longitude]}
                      radius={30}
                      pathOptions={{
                        fillColor: '#4CAF50', // Green for place entities
                        fillOpacity: 0.2,
                        color: '#4CAF50',
                        weight: 2,
                        className: 'pulsing-marker'
                      }}
                    />
                  )}

                  {/* Main entity marker */}
                  <CircleMarker
                    center={[location.latitude, location.longitude]}
                    radius={15}
                    pathOptions={{
                      fillColor: '#4CAF50', // Green for place entities
                      fillOpacity: isSelected ? 0.8 : 0.6,
                      color: '#388E3C',
                      weight: isSelected ? 3 : 2,
                      stroke: true,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        handleEntityMarkerClick(entity._id, e.originalEvent.shiftKey);
                      },
                    }}
                  >
                    <Popup>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                          📍 {entity.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#4CAF50', fontWeight: 'medium' }}>
                          Place Entity
                        </Typography>
                        {entity.description && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {entity.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
                          <Typography variant="caption">Importance:</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {'★'.repeat(entity.importance)}{'☆'.repeat(5 - entity.importance)}
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                          Location: {location.name}
                        </Typography>
                        {isSelected && (
                          <Typography variant="caption" display="block" sx={{ mt: 1, color: '#4CAF50', fontWeight: 'bold' }}>
                            ● Selected Place Entity
                          </Typography>
                        )}
                      </Box>
                    </Popup>
                  </CircleMarker>

                  {/* Entity location radius circle */}
                  {location.radius && (
                    <Circle
                      center={[location.latitude, location.longitude]}
                      radius={location.radius}
                      pathOptions={{
                        fillColor: '#4CAF50',
                        fillOpacity: isSelected ? 0.2 : 0.1,
                        color: '#4CAF50',
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
            .filter(location =>
              !events.some(event => event.locationId?._id === location._id) &&
              !entities.some(entity => entity.locationId?._id === location._id)
            )
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