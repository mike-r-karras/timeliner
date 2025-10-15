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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Divider,
  Rating,
} from '@mui/material';
import { AttachFile, Delete, Visibility, Add, Link as LinkIcon, Edit } from '@mui/icons-material';
import AttachmentViewer from './AttachmentViewer';
import LocationModal from './LocationModal';

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
  caption?: string;
  altText?: string;
  creator?: string;
  creditLine?: string;
  copyright?: string;
  date?: string;
}

interface Link {
  _id: string;
  title: string;
  url: string;
}

interface EntityModalProps {
  open: boolean;
  onClose: () => void;
  timelineId: string | null;
  onEntityCreated: () => void;
  entityId?: string;
  defaultType?: string;
}

const entityTypes = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
  { value: 'place', label: 'Place' },
  { value: 'object', label: 'Object' },
  { value: 'concept', label: 'Concept' },
  { value: 'other', label: 'Other' },
];

export default function EntityModal({
  open,
  onClose,
  timelineId,
  onEntityCreated,
  entityId,
  defaultType,
}: EntityModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: defaultType || 'person',
    description: '',
    importance: 3,
    locationId: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
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
      if (entityId) {
        fetchEntity();
      } else {
        resetForm();
      }
    }
  }, [open, entityId, defaultType]);

  const resetForm = () => {
    setFormData({
      name: '',
      type: defaultType || 'person',
      description: '',
      importance: 3,
      locationId: '',
    });
    setError('');
    setAttachments([]);
    setLinks([]);
    setPendingFiles([]);
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

  const fetchEntity = async () => {
    if (!entityId) return;

    try {
      const [entityResponse, attachmentsResponse, linksResponse] = await Promise.all([
        fetch(`/api/entities/${entityId}`),
        fetch(`/api/attachments?entityId=${entityId}`),
        fetch(`/api/links?entityId=${entityId}`)
      ]);

      if (entityResponse.ok) {
        const entity = await entityResponse.json();
        setFormData({
          name: entity.name,
          type: entity.type,
          description: entity.description || '',
          importance: entity.importance || 3,
          locationId: entity.locationId || '',
        });
      }

      if (attachmentsResponse.ok) {
        const attachmentData = await attachmentsResponse.json();
        setAttachments(attachmentData);
      }

      if (linksResponse.ok) {
        const linksData = await linksResponse.json();
        setLinks(linksData);
      }
    } catch (error) {
      console.error('Error fetching entity:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineId || !formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const entityData = {
        ...formData,
        timelineId,
      };

      const url = entityId ? `/api/entities/${entityId}` : '/api/entities';
      const method = entityId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entityData),
      });

      if (response.ok) {
        const savedEntity = await response.json();

        // If this is a new entity and we have pending files, upload them now
        if (!entityId && pendingFiles.length > 0) {
          await uploadPendingFiles(savedEntity._id);
        }

        onEntityCreated();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save entity');
      }
    } catch (error) {
      setError('Error saving entity');
    } finally {
      setLoading(false);
    }
  };

  const uploadPendingFiles = async (newEntityId: string) => {
    if (pendingFiles.length === 0) return;

    const uploadedAttachments: Attachment[] = [];

    try {
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityId', newEntityId);

        const response = await fetch('/api/attachments/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          uploadedAttachments.push(result.attachment);
        }
      }

      setAttachments(prev => [...prev, ...uploadedAttachments]);
      setPendingFiles([]);
    } catch (error) {
      console.error('Upload pending files failed:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Handle one file at a time with metadata dialog
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

    // Clear the input
    event.target.value = '';
  };

  const handleMetadataConfirm = async () => {
    if (editingAttachmentId) {
      // Update existing attachment metadata
      setUploading(true);

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
          setError('Failed to update attachment metadata');
        }
      } catch (error) {
        console.error('Error updating attachment metadata:', error);
        setError('Error updating attachment metadata');
      } finally {
        setUploading(false);
      }
    } else if (pendingFile) {
      if (entityId) {
        // Entity exists, upload immediately with metadata
        setUploading(true);

        try {
          const formData = new FormData();
          formData.append('file', pendingFile);
          formData.append('entityId', entityId);
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
          }
        } catch (error) {
          console.error('Upload failed:', error);
          setError('Failed to upload file');
        } finally {
          setUploading(false);
        }
      } else {
        // New entity, store file for later upload
        setPendingFiles(prev => [...prev, pendingFile]);

        // Create preview object for pending file
        const previewAttachment = {
          _id: `pending-${Date.now()}-${Math.random()}`, // Temporary ID
          filename: pendingFile.name,
          originalName: pendingFile.name,
          mimeType: pendingFile.type,
          size: pendingFile.size,
          url: '', // No URL yet since it's not uploaded
          type: getFileType(pendingFile.type),
        };

        setAttachments(prev => [...prev, previewAttachment]);
        setMetadataDialogOpen(false);
        setPendingFile(null);
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

  const handleAttachmentDelete = async (attachmentId: string) => {
    // Check if it's a pending file (temporary ID starts with "pending-")
    if (attachmentId.startsWith('pending-')) {
      // Remove from pending files and attachments
      const attachment = attachments.find(att => att._id === attachmentId);
      if (attachment) {
        setPendingFiles(prev => prev.filter(file => file.name !== attachment.originalName));
        setAttachments(prev => prev.filter(att => att._id !== attachmentId));
      }
      return;
    }

    // For existing attachments, call the API to delete
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAttachments(prev => prev.filter(att => att._id !== attachmentId));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleAttachmentView = (attachment: Attachment) => {
    // Don't allow viewing pending files (they don't have URLs yet)
    if (attachment._id.startsWith('pending-')) {
      return;
    }

    // In edit mode, open metadata editor; otherwise open viewer
    if (entityId) {
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
    if (!linkData.title.trim() || !linkData.url.trim() || !entityId) return;

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
            entityId,
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

  const handleAddLocation = () => {
    setEditingLocationId(null);
    setLocationModalOpen(true);
  };

  const handleEditLocation = () => {
    if (formData.locationId) {
      setEditingLocationId(formData.locationId);
      setLocationModalOpen(true);
    }
  };

  const handleLocationCreated = (location: Location) => {
    if (editingLocationId) {
      // Update existing location in the list
      setLocations(prev => prev.map(loc => loc._id === location._id ? location : loc));
    } else {
      // Add new location to the list and select it
      setLocations(prev => [...prev, location]);
    }
    setFormData(prev => ({ ...prev, locationId: location._id }));
    setLocationModalOpen(false);
    setEditingLocationId(null);
  };

  const getFileType = (mimeType: string): 'photo' | 'video' | 'audio' | 'document' | 'other' => {
    if (mimeType.startsWith('image/')) return 'photo';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf' || mimeType.includes('text/')) return 'document';
    return 'other';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {entityId ? 'Edit Entity' : 'Create New Entity'}
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
              label="Entity Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <FormControl fullWidth required>
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={formData.type}
                label="Entity Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {entityTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter a description for this entity..."
            />

            <Box>
              <Typography component="legend" sx={{ mb: 1 }}>
                Importance
              </Typography>
              <Rating
                value={formData.importance}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, importance: newValue || 1 });
                }}
                size="large"
              />
            </Box>

            {/* Location Selection - Only show for 'place' entity type */}
            {formData.type === 'place' && (
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
                  onClick={handleEditLocation}
                  disabled={!formData.locationId}
                  sx={{
                    height: 56, // Match Select component height
                    width: 56,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&.Mui-disabled': {
                      bgcolor: 'action.disabledBackground',
                      color: 'action.disabled',
                    },
                  }}
                  title="Edit selected location"
                >
                  <Edit />
                </IconButton>
                <IconButton
                  onClick={handleAddLocation}
                  sx={{
                    height: 56, // Match Select component height
                    width: 56,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                  title="Add new location"
                >
                  <Add />
                </IconButton>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Attachments Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Attachments</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {uploading && <CircularProgress size={20} />}
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="entity-file-upload"
                    accept="*/*"
                  />
                  <label htmlFor="entity-file-upload">
                    <Button
                      component="span"
                      variant="outlined"
                      startIcon={<AttachFile />}
                      size="small"
                      disabled={uploading}
                    >
                      Add Files
                    </Button>
                  </label>
                </Box>
              </Box>

              {attachments.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {attachments.map((attachment) => (
                    <Box
                      key={attachment._id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        gap: 1,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {attachment.originalName}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={attachment.type}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(attachment.size)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleAttachmentView(attachment)}
                          disabled={attachment._id.startsWith('pending-')}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleAttachmentDelete(attachment._id)}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {attachments.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No attachments yet. Click "Add Files" to upload documents, images, or other files.
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Links Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Links</Typography>
                <Button
                  variant="outlined"
                  onClick={handleAddLink}
                  startIcon={<Add />}
                  size="small"
                  disabled={!entityId}
                >
                  Add Link
                </Button>
              </Box>

              {!entityId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Save the entity first to add links.
                </Alert>
              )}

              {links.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {links.map((link) => (
                    <Box
                      key={link._id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        gap: 1,
                      }}
                    >
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

                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditLink(link)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteLink(link._id)}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {links.length === 0 && entityId && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No links yet. Click "Add Link" to add relevant URLs.
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Saving...' : entityId ? 'Update' : 'Create'}
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
        onClose={() => {
          setLocationModalOpen(false);
          setEditingLocationId(null);
        }}
        onLocationCreated={handleLocationCreated}
        locationId={editingLocationId || undefined}
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
          <Button onClick={handleMetadataCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleMetadataConfirm}
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : null}
          >
            {uploading ? (editingAttachmentId ? 'Saving...' : 'Uploading...') : (editingAttachmentId ? 'Save' : (entityId ? 'Upload' : 'Add'))}
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
  );
}