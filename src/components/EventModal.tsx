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
import { CloudUpload, Delete, InsertDriveFile, Add, Link as LinkIcon, Edit } from '@mui/icons-material';
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
  caption?: string;
  altText?: string;
  creator?: string;
  creditLine?: string;
  copyright?: string;
  date?: string;
  createdAt: string;
}

interface Link {
  _id: string;
  title: string;
  url: string;
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
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState({
    caption: '',
    altText: '',
    creator: '',
    creditLine: '',
    copyright: '',
    date: '',
  });
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkData, setLinkData] = useState({
    title: '',
    url: '',
  });
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLocations();
      if (eventId) {
        fetchEvent();
        fetchAttachments();
        fetchLinks();
      } else {
        resetForm();
        setAttachments([]);
        setLinks([]);
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
    setLinks([]);
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
          locationId: (typeof event.locationId === 'object' ? event.locationId?._id : event.locationId) || '',
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

  const fetchLinks = async () => {
    if (!eventId) return;

    try {
      const response = await fetch(`/api/links?eventId=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        setLinks(data);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !eventId) return;

    // For now, handle one file at a time
    const file = files[0];
    setPendingFile(file);
    setFileMetadata({
      caption: '',
      altText: '',
      creator: '',
      creditLine: '',
      copyright: '',
      date: '',
    });
    setMetadataDialogOpen(true);
    event.target.value = ''; // Reset input
  };

  const handleMetadataConfirm = async () => {
    if (editingAttachmentId) {
      // Update existing attachment metadata
      setUploadingFile(true);

      try {
        const response = await fetch(`/api/attachments/${editingAttachmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: fileMetadata.caption,
            altText: fileMetadata.altText,
            creator: fileMetadata.creator,
            creditLine: fileMetadata.creditLine,
            copyright: fileMetadata.copyright,
            date: fileMetadata.date,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setAttachments(prev => prev.map(att =>
            att._id === editingAttachmentId ? result.attachment : att
          ));
          setMetadataDialogOpen(false);
          setEditingAttachmentId(null);
        } else {
          console.error('Failed to update attachment metadata');
        }
      } catch (error) {
        console.error('Error updating attachment metadata:', error);
      } finally {
        setUploadingFile(false);
      }
    } else if (pendingFile && eventId) {
      // Upload new file with metadata
      setUploadingFile(true);

      try {
        const formData = new FormData();
        formData.append('file', pendingFile);
        formData.append('eventId', eventId);
        formData.append('caption', fileMetadata.caption);
        formData.append('altText', fileMetadata.altText);
        formData.append('creator', fileMetadata.creator);
        formData.append('creditLine', fileMetadata.creditLine);
        formData.append('copyright', fileMetadata.copyright);
        formData.append('date', fileMetadata.date);

        const response = await fetch('/api/attachments/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          setAttachments(prev => [...prev, result.attachment]);
          setMetadataDialogOpen(false);
          setPendingFile(null);
        } else {
          console.error('Failed to upload file:', pendingFile.name);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      } finally {
        setUploadingFile(false);
      }
    }
  };

  const handleMetadataCancel = () => {
    setMetadataDialogOpen(false);
    setPendingFile(null);
    setEditingAttachmentId(null);
    setFileMetadata({
      caption: '',
      altText: '',
      creator: '',
      creditLine: '',
      copyright: '',
      date: '',
    });
  };

  const handleEditAttachmentMetadata = (attachment: Attachment) => {
    setEditingAttachmentId(attachment._id);
    setFileMetadata({
      caption: attachment.caption || '',
      altText: attachment.altText || '',
      creator: attachment.creator || '',
      creditLine: attachment.creditLine || '',
      copyright: attachment.copyright || '',
      date: attachment.date ? attachment.date.split('T')[0] : '',
    });
    setMetadataDialogOpen(true);
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

  const handleAddLink = () => {
    setEditingLinkId(null);
    setLinkData({ title: '', url: '' });
    setLinkDialogOpen(true);
  };

  const handleEditLink = (link: Link) => {
    setEditingLinkId(link._id);
    setLinkData({ title: link.title, url: link.url });
    setLinkDialogOpen(true);
  };

  const handleLinkDialogClose = () => {
    setLinkDialogOpen(false);
    setEditingLinkId(null);
    setLinkData({ title: '', url: '' });
  };

  const handleSaveLink = async () => {
    if (!linkData.title.trim() || !linkData.url.trim() || !eventId) return;

    setSavingLink(true);

    try {
      if (editingLinkId) {
        // Update existing link
        const response = await fetch(`/api/links/${editingLinkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: linkData.title.trim(),
            url: linkData.url.trim(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setLinks(prev => prev.map(link =>
            link._id === editingLinkId ? result.link : link
          ));
          handleLinkDialogClose();
        }
      } else {
        // Create new link
        const response = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: linkData.title.trim(),
            url: linkData.url.trim(),
            eventId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setLinks(prev => [...prev, result.link]);
          handleLinkDialogClose();
        }
      }
    } catch (error) {
      console.error('Error saving link:', error);
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/links/${linkId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLinks(prev => prev.filter(link => link._id !== linkId));
      }
    } catch (error) {
      console.error('Error deleting link:', error);
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
    // In edit mode, open metadata editor; otherwise open viewer
    if (eventId) {
      handleEditAttachmentMetadata(attachment);
    } else {
      setSelectedAttachment(attachment);
      setViewerOpen(true);
    }
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

              {/* Links Section */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Links
                </Typography>

                {eventId && (
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={handleAddLink}
                      startIcon={<Add />}
                      fullWidth
                    >
                      Add Link
                    </Button>
                  </Box>
                )}

                {!eventId && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Save the event first to add links.
                  </Alert>
                )}

                {links.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {links.map((link) => (
                      <Card
                        key={link._id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          p: 1,
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 1 }}>
                          <Box sx={{
                            width: 40,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'primary.light',
                            borderRadius: 1,
                          }}>
                            <LinkIcon sx={{ color: 'primary.contrastText' }} />
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }} noWrap>
                              {link.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="primary"
                              component="a"
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline',
                                },
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {link.url}
                            </Typography>
                          </Box>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={() => handleEditLink(link)}
                          sx={{ ml: 1 }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>

                        <IconButton
                          size="small"
                          onClick={() => handleDeleteLink(link._id)}
                          sx={{ ml: 0.5 }}
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

        {/* Attachment Metadata Dialog */}
        <Dialog
          open={metadataDialogOpen}
          onClose={handleMetadataCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingAttachmentId ? 'Edit File Metadata' : 'Add File Metadata'}
            {pendingFile && (
              <Typography variant="caption" display="block" color="text.secondary">
                {pendingFile.name}
              </Typography>
            )}
            {editingAttachmentId && !pendingFile && (
              <Typography variant="caption" display="block" color="text.secondary">
                {attachments.find(a => a._id === editingAttachmentId)?.originalName}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Caption"
                value={fileMetadata.caption}
                onChange={(e) => setFileMetadata(prev => ({ ...prev, caption: e.target.value }))}
                multiline
                rows={3}
                fullWidth
                placeholder="Describe this file..."
              />

              <TextField
                label="Alt Text"
                value={fileMetadata.altText}
                onChange={(e) => setFileMetadata(prev => ({ ...prev, altText: e.target.value }))}
                fullWidth
                placeholder="Alternative text for accessibility..."
              />

              <TextField
                label="Creator / Byline"
                value={fileMetadata.creator}
                onChange={(e) => setFileMetadata(prev => ({ ...prev, creator: e.target.value }))}
                fullWidth
                placeholder="Who created this file..."
              />

              <TextField
                label="Credit Line (Provider)"
                value={fileMetadata.creditLine}
                onChange={(e) => setFileMetadata(prev => ({ ...prev, creditLine: e.target.value }))}
                fullWidth
                placeholder="Source or provider..."
              />

              <TextField
                label="Copyright Notice"
                value={fileMetadata.copyright}
                onChange={(e) => setFileMetadata(prev => ({ ...prev, copyright: e.target.value }))}
                fullWidth
                placeholder="Copyright information..."
              />

              <TextField
                label="Date"
                type="date"
                value={fileMetadata.date}
                onChange={(e) => setFileMetadata(prev => ({ ...prev, date: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleMetadataCancel} disabled={uploadingFile}>
              Cancel
            </Button>
            <Button
              onClick={handleMetadataConfirm}
              variant="contained"
              disabled={uploadingFile}
              startIcon={uploadingFile ? <CircularProgress size={16} /> : null}
            >
              {uploadingFile ? (editingAttachmentId ? 'Saving...' : 'Uploading...') : (editingAttachmentId ? 'Save' : 'Upload')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Link Dialog */}
        <Dialog
          open={linkDialogOpen}
          onClose={handleLinkDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingLinkId ? 'Edit Link' : 'Add Link'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Title"
                value={linkData.title}
                onChange={(e) => setLinkData(prev => ({ ...prev, title: e.target.value }))}
                fullWidth
                required
                placeholder="Link title..."
              />

              <TextField
                label="URL"
                value={linkData.url}
                onChange={(e) => setLinkData(prev => ({ ...prev, url: e.target.value }))}
                fullWidth
                required
                placeholder="https://..."
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleLinkDialogClose} disabled={savingLink}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLink}
              variant="contained"
              disabled={savingLink || !linkData.title.trim() || !linkData.url.trim()}
              startIcon={savingLink ? <CircularProgress size={16} /> : null}
            >
              {savingLink ? 'Saving...' : editingLinkId ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </LocalizationProvider>
  );
}