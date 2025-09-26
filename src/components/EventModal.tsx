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
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Autocomplete,
  IconButton,
  Chip,
  Card,
  CardMedia,
  CircularProgress,
} from '@mui/material';
import { CloudUpload, Delete, InsertDriveFile, Add } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import AttachmentViewer from './AttachmentViewer';
import LocationModal from './LocationModal';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface Location {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: 'photo' | 'video' | 'audio' | 'document' | 'other';
  eventId: string;
  createdAt: string;
}

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  timelineId: string | null;
  onEventCreated: () => void;
  eventId?: string;
}

export default function EventModal({
  open,
  onClose,
  timelineId,
  onEventCreated,
  eventId,
}: EventModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDateTime: new Date(),
    endDateTime: null as Date | null,
    importance: 3,
    locationId: '',
  });

  const [locations, setLocations] = useState<Location[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLocations();
      if (eventId) {
        fetchEvent();
        fetchAttachments();
      } else {
        resetForm();
        setAttachments([]);
      }
    }
  }, [open, eventId]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      startDateTime: new Date(),
      endDateTime: null,
      importance: 3,
      locationId: '',
    });
    setError('');
    setAttachments([]);
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchEvent = async () => {
    if (!eventId) return;

    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const event = await response.json();
        setFormData({
          title: event.title,
          description: event.description || '',
          startDateTime: new Date(event.startDateTime),
          endDateTime: event.endDateTime ? new Date(event.endDateTime) : null,
          importance: event.importance,
          locationId: event.locationId || '',
        });
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const fetchAttachments = async () => {
    if (!eventId) return;

    try {
      const response = await fetch(`/api/attachments?eventId=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !eventId) return;

    setUploadingFile(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('eventId', eventId);

        const response = await fetch('/api/attachments/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          setAttachments(prev => [...prev, result.attachment]);
        } else {
          console.error('Failed to upload file:', file.name);
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploadingFile(false);
      event.target.value = ''; // Reset input
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAttachments(prev => prev.filter(att => att._id !== attachmentId));
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  const getFileTypeIcon = (mimeType: string, type: string) => {
    if (type === 'photo' || mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (type === 'video' || mimeType.startsWith('video/')) {
      return '🎥';
    } else if (type === 'audio' || mimeType.startsWith('audio/')) {
      return '🎵';
    } else if (type === 'document' || mimeType.includes('pdf') || mimeType.includes('document')) {
      return '📄';
    }
    return '📎';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAttachmentClick = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    setSelectedAttachment(null);
  };

  const handleAddLocation = () => {
    setLocationModalOpen(true);
  };

  const handleLocationCreated = (location: Location) => {
    // Add the new location to the list and select it
    setLocations(prev => [...prev, location]);
    setFormData(prev => ({ ...prev, locationId: location._id }));
    setLocationModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineId || !formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const eventData = {
        ...formData,
        timelineId,
        startDateTime: formData.startDateTime.toISOString(),
        endDateTime: formData.endDateTime?.toISOString() || null,
        locationId: formData.locationId || null,
      };

      const url = eventId ? `/api/events/${eventId}` : '/api/events';
      const method = eventId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        onEventCreated();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save event');
      }
    } catch (error) {
      setError('Error saving event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {eventId ? 'Edit Event' : 'Create New Event'}
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
                label="Event Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />

              <DateTimePicker
                label="Start Date & Time"
                value={formData.startDateTime}
                onChange={(date) => date && setFormData({ ...formData, startDateTime: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />

              <DateTimePicker
                label="End Date & Time (Optional)"
                value={formData.endDateTime}
                onChange={(date) => setFormData({ ...formData, endDateTime: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />

              <Box>
                <Typography component="legend" gutterBottom>
                  Importance Level
                </Typography>
                <Rating
                  value={formData.importance}
                  onChange={(_, value) => setFormData({ ...formData, importance: value || 1 })}
                  max={5}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <FormControl fullWidth>
                  <InputLabel>Location (Optional)</InputLabel>
                  <Select
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    label="Location (Optional)"
                  >
                    <MenuItem value="">
                      <em>No location</em>
                    </MenuItem>
                    {locations.map((location) => (
                      <MenuItem key={location._id} value={location._id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  onClick={handleAddLocation}
                  sx={{
                    color: 'primary.main',
                    border: '1px solid',
                    borderColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                    },
                  }}
                >
                  <Add />
                </IconButton>
              </Box>

              {/* File Attachments Section */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Attachments
                </Typography>

                {eventId && (
                  <Box sx={{ mb: 2 }}>
                    <input
                      accept="*/*"
                      style={{ display: 'none' }}
                      id="file-upload"
                      multiple
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                    <label htmlFor="file-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={uploadingFile ? <CircularProgress size={20} /> : <CloudUpload />}
                        disabled={uploadingFile}
                        fullWidth
                      >
                        {uploadingFile ? 'Uploading...' : 'Upload Files'}
                      </Button>
                    </label>
                  </Box>
                )}

                {!eventId && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Save the event first to upload attachments.
                  </Alert>
                )}

                {attachments.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {attachments.map((attachment) => (
                      <Card
                        key={attachment._id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          p: 1,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                        onClick={() => handleAttachmentClick(attachment)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 1 }}>
                          {attachment.mimeType.startsWith('image/') ? (
                            <CardMedia
                              component="img"
                              sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }}
                              image={attachment.url}
                              alt={attachment.originalName}
                            />
                          ) : (
                            <Box sx={{
                              width: 40,
                              height: 40,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'grey.100',
                              borderRadius: 1,
                              fontSize: '18px'
                            }}>
                              {getFileTypeIcon(attachment.mimeType, attachment.type)}
                            </Box>
                          )}

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }} noWrap>
                              {attachment.originalName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatFileSize(attachment.size)} • {attachment.type}
                            </Typography>
                          </Box>

                          <Chip
                            label={attachment.type}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAttachment(attachment._id);
                          }}
                          sx={{ ml: 1 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Card>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Saving...' : eventId ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>

        {/* Attachment Viewer Modal */}
        <AttachmentViewer
          open={viewerOpen}
          onClose={handleViewerClose}
          attachment={selectedAttachment}
        />

        {/* Location Creation Modal */}
        <LocationModal
          open={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
          onLocationCreated={handleLocationCreated}
        />
      </Dialog>
    </LocalizationProvider>
  );
}