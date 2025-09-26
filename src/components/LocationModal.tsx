'use client';

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { LocationOn, Search, MyLocation } from '@mui/icons-material';
import dynamic from 'next/dynamic';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });

interface LocationResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  placeId?: string;
}

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onLocationCreated: (location: any) => void;
  locationId?: string;
  initialCoordinates?: { lat: number; lng: number } | null;
}

export default function LocationModal({
  open,
  onClose,
  onLocationCreated,
  locationId,
  initialCoordinates,
}: LocationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: 'United States',
    latitude: '',
    longitude: '',
    radius: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [autoGeocode, setAutoGeocode] = useState(true);
  const [geocoded, setGeocoded] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (open) {
      if (locationId) {
        fetchLocation();
      } else {
        resetForm();
        // Set initial coordinates if provided (e.g., from map click)
        if (initialCoordinates) {
          setFormData(prev => ({
            ...prev,
            latitude: initialCoordinates.lat.toString(),
            longitude: initialCoordinates.lng.toString(),
          }));
          setGeocoded(true);
        }
      }
    }
  }, [open, locationId, initialCoordinates?.lat, initialCoordinates?.lng]);

  const resetForm = () => {
    setFormData({
      name: '',
      streetAddress: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      country: 'United States',
      latitude: '',
      longitude: '',
      radius: '',
      description: '',
    });
    setError('');
    setSearchResults([]);
    setGeocoded(false);
  };

  const fetchLocation = async () => {
    if (!locationId) return;

    try {
      const response = await fetch(`/api/locations/${locationId}`);
      if (response.ok) {
        const location = await response.json();
        setFormData({
          name: location.name || '',
          streetAddress: location.streetAddress || '',
          city: location.city || '',
          stateProvince: location.stateProvince || '',
          postalCode: location.postalCode || '',
          country: location.country || 'United States',
          latitude: location.latitude?.toString() || '',
          longitude: location.longitude?.toString() || '',
          radius: location.radius?.toString() || '',
          description: location.description || '',
        });
        setGeocoded(location.geocoded || false);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    }
  };

  const handleLocationSearch = async (searchQuery: string) => {
    if (!searchQuery?.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLocationSelect = (locationResult: LocationResult) => {
    setFormData(prev => ({
      ...prev,
      streetAddress: locationResult.streetAddress || prev.streetAddress,
      city: locationResult.city || prev.city,
      stateProvince: locationResult.stateProvince || prev.stateProvince,
      postalCode: locationResult.postalCode || prev.postalCode,
      country: locationResult.country || prev.country,
      latitude: locationResult.latitude.toString(),
      longitude: locationResult.longitude.toString(),
    }));
    setGeocoded(true);
    setSearchResults([]);
  };

  const handleGeocodeAddress = async () => {
    const addressComponents = [
      formData.streetAddress,
      formData.city,
      formData.stateProvince,
      formData.postalCode,
      formData.country,
    ].filter(Boolean);

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
        setFormData(prev => ({
          ...prev,
          latitude: result.latitude.toString(),
          longitude: result.longitude.toString(),
          streetAddress: result.streetAddress || prev.streetAddress,
          city: result.city || prev.city,
          stateProvince: result.stateProvince || prev.stateProvince,
          postalCode: result.postalCode || prev.postalCode,
          country: result.country || prev.country,
        }));
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

  const handleGetCurrentLocation = () => {
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
          latitude: lat.toString(),
          longitude: lng.toString(),
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
            setFormData(prev => ({
              ...prev,
              streetAddress: result.streetAddress || prev.streetAddress,
              city: result.city || prev.city,
              stateProvince: result.stateProvince || prev.stateProvince,
              postalCode: result.postalCode || prev.postalCode,
              country: result.country || prev.country,
            }));
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
        }

        setGeocoded(true);
        setLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Unable to get current location');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Location name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const locationData = {
        name: formData.name.trim(),
        streetAddress: formData.streetAddress.trim() || undefined,
        city: formData.city.trim() || undefined,
        stateProvince: formData.stateProvince.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        country: formData.country.trim() || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        radius: formData.radius ? parseFloat(formData.radius) : undefined,
        description: formData.description.trim() || undefined,
        geocodeAddress: autoGeocode && !formData.latitude && !formData.longitude,
      };

      const url = locationId ? `/api/locations/${locationId}` : '/api/locations';
      const method = locationId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
      });

      if (response.ok) {
        const location = await response.json();
        onLocationCreated(location);
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save location');
      }
    } catch (error) {
      setError('Error saving location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOn />
          {locationId ? 'Edit Location' : 'Add New Location'}
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              required
              fullWidth
              label="Location Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Home, Office, Central Park"
            />

            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              Address Information
            </Typography>

            <Autocomplete
              freeSolo
              options={searchResults}
              loading={searchLoading}
              getOptionLabel={(option) =>
                typeof option === 'string' ? option : option.formattedAddress
              }
              renderOption={(props, option) => (
                <Box component="li" {...props} onClick={() => handleLocationSelect(option)}>
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
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search for address"
                  placeholder="Start typing an address..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                    endAdornment: searchLoading ? <CircularProgress size={20} /> : null,
                  }}
                />
              )}
              onInputChange={(_, value) => handleLocationSearch(value)}
            />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Street Address"
                  value={formData.streetAddress}
                  onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                  placeholder="123 Main St"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="New York"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="State/Province"
                  value={formData.stateProvince}
                  onChange={(e) => setFormData({ ...formData, stateProvince: e.target.value })}
                  placeholder="NY"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Postal Code"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="10001"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="United States"
                />
              </Grid>
            </Grid>

            <Divider />

            <Typography variant="h6">Coordinates</Typography>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<MyLocation />}
                onClick={handleGetCurrentLocation}
                disabled={loading}
              >
                Use Current Location
              </Button>

              <Button
                variant="outlined"
                startIcon={<Search />}
                onClick={handleGeocodeAddress}
                disabled={loading}
              >
                Geocode Address
              </Button>

              {geocoded && (
                <Chip
                  label="Geocoded"
                  color="success"
                  size="small"
                />
              )}
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="40.7589"
                  inputProps={{ step: 'any', min: -90, max: 90 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="-73.9851"
                  inputProps={{ step: 'any', min: -180, max: 180 }}
                />
              </Grid>
            </Grid>

            {/* Map Preview */}
            {isClient && formData.latitude && formData.longitude && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Location Preview
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
                    center={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}
                    zoom={15}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maxZoom={19}
                    />
                    <Marker position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]} />
                  </MapContainer>
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              label="Radius (meters)"
              type="number"
              value={formData.radius}
              onChange={(e) => setFormData({ ...formData, radius: e.target.value })}
              placeholder="100"
              inputProps={{ min: 0 }}
              helperText="Optional radius for area coverage visualization"
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional notes about this location..."
            />

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
            {loading ? 'Saving...' : locationId ? 'Update Location' : 'Create Location'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}