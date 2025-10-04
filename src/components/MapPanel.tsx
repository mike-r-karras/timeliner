'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, CircularProgress, IconButton, Tooltip, Fab } from '@mui/material';
import { Add, MyLocation, Search } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

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
  visibleEventIds?: string[];
  onMapReady?: () => void;
}

export default function MapPanel({ timelineId, selectedItems, onSelection, onAddLocation, refreshTrigger, filteredEntityIds, visibleEventIds, onMapReady }: MapPanelProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]); // Geographic center of US default
  const [mapZoom, setMapZoom] = useState(6); // Better default zoom - continental view
  const [addingLocation, setAddingLocation] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<any>(null);

  // Client-only logging to prevent hydration mismatches
  const clientLog = (...args: any[]) => {
    if (typeof window !== 'undefined') {
      console.log(...args);
    }
  };

  useEffect(() => {
    // Fix Leaflet marker icons and set client ready after Leaflet loads
    if (typeof window !== 'undefined') {
      // Import Leaflet dynamically to avoid SSR issues
      import('leaflet').then((L) => {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        // Set client ready after Leaflet is fully loaded and DOM is ready
        setTimeout(() => {
          setIsClient(true);
          onMapReady?.();
        }, 100);
      });
    }
  }, [onMapReady]);

  useEffect(() => {
    if (timelineId) {
      fetchMapData();
    }
  }, [timelineId, refreshTrigger]);

  // Calculate map bounds with useMemo to prevent infinite loops
  const mapBounds = useMemo(() => {
    clientLog('=== MapBounds calculation triggered ===');
    clientLog('Events count:', events.length, 'Entities count:', entities.length);
    clientLog('Events data:', events.slice(0, 2)); // Show first 2 events
    clientLog('Entities data:', entities.slice(0, 2)); // Show first 2 entities
    clientLog('Selected items:', selectedItems);
    clientLog('Filtered entity IDs:', filteredEntityIds);

    if (events.length === 0 && entities.length === 0) {
      clientLog('No events or entities, returning null');
      return null;
    }

    const selectedEventIds = selectedItems?.events || [];
    const selectedEntityIds = selectedItems?.entities || [];
    clientLog('Selected items - events:', selectedEventIds, 'entities:', selectedEntityIds);

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
      return loc &&
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number' &&
        !isNaN(loc.latitude) &&
        !isNaN(loc.longitude) &&
        Math.abs(loc.latitude) <= 90 &&
        Math.abs(loc.longitude) <= 180;
    });

    clientLog('Items with locations - events:', eventsToShow.length, 'entities:', entitiesToShow.length);
    // Temporary debugging
    if (entitiesToShow.length === 0 && entities.length > 0) {
      clientLog('DEBUG: No entities with locations! Total entities:', entities.length);
      clientLog('First entity:', entities[0]?.name, 'locationId:', entities[0]?.locationId ? 'HAS locationId' : 'NO locationId');
      if (entities[0]?.locationId) {
        clientLog('First entity location details:', entities[0].locationId);
      }
    }

    // Apply entity filter if provided
    if (filteredEntityIds && filteredEntityIds.length > 0) {
      clientLog('Applying entity filter:', filteredEntityIds);
      entitiesToShow = entitiesToShow.filter(entity => filteredEntityIds.includes(entity._id));
      clientLog('After entity filter - entities:', entitiesToShow.length);
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

    clientLog('All locations for bounds:', allLocations.map(loc => ({ name: loc.name, lat: loc.latitude, lng: loc.longitude })));

    if (allLocations.length === 0) {
      clientLog('No locations found, returning null');
      clientLog('DEBUG: No locations found! Events:', eventsToShow.length, 'Entities:', entitiesToShow.length);
      return null;
    }

    if (allLocations.length === 1) {
      clientLog('Single location found:', allLocations[0].name, 'at', allLocations[0].latitude, allLocations[0].longitude);
      return {
        center: [allLocations[0].latitude, allLocations[0].longitude] as [number, number],
        zoom: 12 // Better default for single location
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

    clientLog('Calculated bounds:', { minLat, maxLat, minLng, maxLng });
    clientLog('Calculated center:', { centerLat, centerLng });

    // Calculate zoom level based on bounds with padding
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoom = 12; // Default higher zoom for better detail
    if (maxDiff < 0.005) zoom = 17;  // Very close locations - neighborhood level
    else if (maxDiff < 0.01) zoom = 15;   // City district level
    else if (maxDiff < 0.05) zoom = 13;   // City level
    else if (maxDiff < 0.1) zoom = 12;    // Metropolitan area
    else if (maxDiff < 0.5) zoom = 10;    // Regional level
    else if (maxDiff < 1) zoom = 8;       // State level
    else if (maxDiff < 5) zoom = 6;       // Country level
    else zoom = 4; // Continental level

    clientLog('Final map bounds result:', { center: [centerLat, centerLng], zoom });

    return {
      center: [centerLat, centerLng] as [number, number],
      zoom
    };
  }, [events, entities, selectedItems?.events, selectedItems?.entities, filteredEntityIds]);

  // Update map when bounds change
  useEffect(() => {
    if (mapBounds && mapRef.current) {
      clientLog('Updating map bounds to:', mapBounds.center, 'zoom:', mapBounds.zoom);

      // Calculate actual bounds for fitBounds
      let eventsWithLocations = events.filter(event => event.locationId?.latitude && event.locationId?.longitude);

      // Filter events by visibility in timeline
      if (visibleEventIds && visibleEventIds.length > 0) {
        eventsWithLocations = eventsWithLocations.filter(event => visibleEventIds.includes(event._id));
      }

      let entitiesWithLocations = entities.filter(entity => entity.locationId?.latitude && entity.locationId?.longitude);

      // Apply entity filtering if active
      if (filteredEntityIds && filteredEntityIds.length > 0) {
        entitiesWithLocations = entitiesWithLocations.filter(entity => filteredEntityIds.includes(entity._id));
      }
      const allItems = [...eventsWithLocations, ...entitiesWithLocations];

      if (allItems.length > 0) {
        // Create bounds array for Leaflet fitBounds
        const bounds = allItems.map(item => [item.locationId.latitude, item.locationId.longitude]);
        clientLog('Fitting map to bounds:', bounds);

        try {
          const map = mapRef.current;
          map.fitBounds(bounds, { padding: [20, 20] });
          clientLog('fitBounds successful');
        } catch (error) {
          clientLog('fitBounds failed:', error);
          // Fallback to setView
          try {
            map.setView(mapBounds.center, mapBounds.zoom);
            clientLog('Fallback setView successful');
          } catch (fallbackError) {
            clientLog('Fallback setView failed:', fallbackError);
          }
        }
      }
    } else if (events.length > 0 || entities.length > 0) {
      clientLog('No map bounds calculated, staying at current position:', mapCenter);

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
        clientLog('Using fallback location:', fallbackLocation.name, 'at', fallbackLocation.latitude, fallbackLocation.longitude);
        const fallbackCenter: [number, number] = [fallbackLocation.latitude, fallbackLocation.longitude];
        setMapCenter(fallbackCenter);
        setMapZoom(12);
      }
    }
  }, [mapBounds, events, entities]);

  // Additional effect to ensure map updates when data changes or filtering changes
  useEffect(() => {
    if (mapRef.current && (events.length > 0 || entities.length > 0)) {
      // Add a small delay to ensure the map is fully rendered
      const timer = setTimeout(() => {
        let eventsWithLocations = events.filter(event => event.locationId?.latitude && event.locationId?.longitude);

        // Filter events by visibility in timeline
        if (visibleEventIds && visibleEventIds.length > 0) {
          eventsWithLocations = eventsWithLocations.filter(event => visibleEventIds.includes(event._id));
        }

        // Apply entity filtering
        let entitiesWithLocations = entities.filter(entity => entity.locationId?.latitude && entity.locationId?.longitude);
        if (filteredEntityIds && filteredEntityIds.length > 0) {
          entitiesWithLocations = entitiesWithLocations.filter(entity => filteredEntityIds.includes(entity._id));
          clientLog('Applying entity filter - showing', entitiesWithLocations.length, 'of', entities.filter(e => e.locationId?.latitude && e.locationId?.longitude).length, 'entities with locations');
        }

        const allItems = [...eventsWithLocations, ...entitiesWithLocations];

        if (allItems.length > 0) {
          const bounds = allItems.map(item => [item.locationId.latitude, item.locationId.longitude]);
          clientLog('Data/filter changed - refitting map to bounds:', bounds);

          try {
            const map = mapRef.current;
            map.fitBounds(bounds, { padding: [20, 20] });
            clientLog('Data-driven fitBounds successful');
          } catch (error) {
            clientLog('Data-driven fitBounds failed:', error);
          }
        } else {
          clientLog('No items with locations after filtering - keeping current map view');
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [events, entities, filteredEntityIds?.length, filteredEntityIds?.join(','), visibleEventIds?.length, visibleEventIds?.join(',')]); // This effect runs whenever events, entities, or filtering changes

  useEffect(() => {
    // Update map view when center/zoom changes
    if (mapRef.current) {
      mapRef.current.setView(mapCenter, mapZoom);
    }
  }, [mapCenter, mapZoom]);

  const fetchMapData = async () => {
    setLoading(true);
    try {
      clientLog('Fetching map data for timelineId:', timelineId);
      const [eventsResponse, entitiesResponse, locationsResponse] = await Promise.all([
        fetch(`/api/events?timelineId=${timelineId}`),
        fetch(`/api/entities?timelineId=${timelineId}`),
        fetch('/api/locations')
      ]);

      if (eventsResponse.ok) {
        const eventData = await eventsResponse.json();
        clientLog('Fetched events:', eventData.length, 'events');
        clientLog('Sample event:', eventData[0]);
        setEvents(eventData);
      } else {
        console.error('Failed to fetch events:', eventsResponse.status, eventsResponse.statusText);
      }

      if (entitiesResponse.ok) {
        const entityData = await entitiesResponse.json();
        clientLog('Fetched entities:', entityData.length, 'entities');
        clientLog('Sample entity:', entityData[0]);
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

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType) {
      case 'person': return '#E91E63'; // Pink
      case 'organization': return '#3F51B5'; // Indigo
      case 'place': return '#4CAF50'; // Green
      case 'object': return '#FF9800'; // Orange
      case 'concept': return '#9C27B0'; // Purple
      case 'other': return '#607D8B'; // Blue Grey
      default: return '#4CAF50'; // Default to green
    }
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'person': return '👤';
      case 'organization': return '🏢';
      case 'place': return '📍';
      case 'object': return '📦';
      case 'concept': return '💡';
      case 'other': return '❓';
      default: return '📍';
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
            .filter(event => !visibleEventIds || visibleEventIds.length === 0 || visibleEventIds.includes(event._id))
            .map((event) => {
              const location = event.locationId!;
              const isSelected = isEventSelected(event._id);

              clientLog(`Rendering event marker for ${event.title} at [${location.latitude}, ${location.longitude}]`);

              return (
                <React.Fragment key={`event-${event._id}`}>
                  {/* Removed pulsing outer rings to simplify */}

                  {/* Main event marker */}
                  <CircleMarker
                    center={[location.latitude, location.longitude]}
                    radius={isSelected ? 12 : 8}
                    pathOptions={{
                      fillColor: '#FF0000', // Red for events
                      fillOpacity: isSelected ? 1.0 : 0.8,
                      color: isSelected ? '#FFFF00' : '#FFFFFF', // Yellow border when selected
                      weight: isSelected ? 4 : 2,
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

          {/* Entity Markers */}
          {entities
            .filter(entity =>
              entity.locationId?.latitude &&
              entity.locationId?.longitude &&
              (!filteredEntityIds || filteredEntityIds.length === 0 || filteredEntityIds.includes(entity._id))
            )
            .map((entity) => {
              const location = entity.locationId!;
              const isSelected = isEntitySelected(entity._id);

              clientLog(`Rendering entity marker for ${entity.name} (${entity.type}) at [${location.latitude}, ${location.longitude}]`);

              return (
                <React.Fragment key={`entity-${entity._id}`}>
                  {/* Removed pulsing outer ring to simplify */}

                  {/* Main entity marker */}
                  <CircleMarker
                    center={[location.latitude, location.longitude]}
                    radius={isSelected ? 15 : 10}
                    pathOptions={{
                      fillColor: '#0000FF', // Blue for entities
                      fillOpacity: isSelected ? 1.0 : 0.8,
                      color: isSelected ? '#FFFF00' : '#FFFFFF', // Yellow border when selected
                      weight: isSelected ? 4 : 2,
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
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: getEntityTypeColor(entity.type) }}>
                          {getEntityTypeIcon(entity.type)} {entity.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: getEntityTypeColor(entity.type), fontWeight: 'medium' }}>
                          {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)} Entity
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
                          <Typography variant="caption" display="block" sx={{ mt: 1, color: getEntityTypeColor(entity.type), fontWeight: 'bold' }}>
                            ● Selected {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)} Entity
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
                        fillColor: getEntityTypeColor(entity.type),
                        fillOpacity: isSelected ? 0.2 : 0.1,
                        color: getEntityTypeColor(entity.type),
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