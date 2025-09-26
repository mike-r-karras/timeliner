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
import { AttachFile, Delete, Visibility } from '@mui/icons-material';
import AttachmentViewer from './AttachmentViewer';

interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: 'photo' | 'video' | 'audio' | 'document' | 'other';
}

interface EntityModalProps {
  open: boolean;
  onClose: () => void;
  timelineId: string | null;
  onEntityCreated: () => void;
  entityId?: string;
}

const entityTypes = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
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
}: EntityModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'person',
    description: '',
    importance: 3,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);

  useEffect(() => {
    if (open) {
      if (entityId) {
        fetchEntity();
      } else {
        resetForm();
      }
    }
  }, [open, entityId]);

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'person',
      description: '',
      importance: 3,
    });
    setError('');
    setAttachments([]);
  };

  const fetchEntity = async () => {
    if (!entityId) return;

    try {
      const [entityResponse, attachmentsResponse] = await Promise.all([
        fetch(`/api/entities/${entityId}`),
        fetch(`/api/attachments?entityId=${entityId}`)
      ]);

      if (entityResponse.ok) {
        const entity = await entityResponse.json();
        setFormData({
          name: entity.name,
          type: entity.type,
          description: entity.description || '',
          importance: entity.importance || 3,
        });
      }

      if (attachmentsResponse.ok) {
        const attachmentData = await attachmentsResponse.json();
        setAttachments(attachmentData);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedAttachments: Attachment[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        if (entityId) {
          formData.append('entityId', entityId);
        }

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
    } catch (error) {
      console.error('Upload failed:', error);
      setError('Failed to upload files');
    } finally {
      setUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
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
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    setSelectedAttachment(null);
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

            <Divider sx={{ my: 2 }} />

            {/* Attachments Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Attachments</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {uploading && <CircularProgress size={20} />}
                  <input
                    type="file"
                    multiple
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
    </Dialog>
  );
}