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
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Typography,
  Alert,
  Divider,
  Chip,
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  FileCopy,
  MoreVert,
  Timeline as TimelineIcon,
  Save,
  FolderOpen,
} from '@mui/icons-material';

interface Timeline {
  _id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface TimelineManagerProps {
  open: boolean;
  onClose: () => void;
  currentTimelineId?: string;
  onTimelineChange: (timelineId: string) => void;
}

export default function TimelineManager({
  open,
  onClose,
  currentTimelineId,
  onTimelineChange,
}: TimelineManagerProps) {
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [newTimelineData, setNewTimelineData] = useState({
    title: '',
    description: '',
  });

  useEffect(() => {
    if (open) {
      fetchTimelines();
    }
  }, [open]);

  const fetchTimelines = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/timelines');
      if (response.ok) {
        const data = await response.json();
        setTimelines(data);
      } else {
        throw new Error('Failed to fetch timelines');
      }
    } catch (error) {
      setError('Error loading timelines');
      console.error('Error fetching timelines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimeline = async () => {
    if (!newTimelineData.title.trim()) {
      setError('Timeline title is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTimelineData),
      });

      if (response.ok) {
        const timeline = await response.json();
        await fetchTimelines();
        onTimelineChange(timeline._id);
        setCreateDialogOpen(false);
        setNewTimelineData({ title: '', description: '' });
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create timeline');
      }
    } catch (error) {
      setError('Error creating timeline');
      console.error('Error creating timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTimeline = async () => {
    if (!selectedTimeline || !newTimelineData.title.trim()) {
      setError('Timeline title is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/timelines/${selectedTimeline._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTimelineData),
      });

      if (response.ok) {
        await fetchTimelines();
        setEditDialogOpen(false);
        setSelectedTimeline(null);
        setNewTimelineData({ title: '', description: '' });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update timeline');
      }
    } catch (error) {
      setError('Error updating timeline');
      console.error('Error updating timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateTimeline = async () => {
    if (!selectedTimeline || !newTimelineData.title.trim()) {
      setError('Timeline title is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/timelines/${selectedTimeline._id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTimelineData.title }),
      });

      if (response.ok) {
        const timeline = await response.json();
        await fetchTimelines();
        onTimelineChange(timeline._id);
        setDuplicateDialogOpen(false);
        setSelectedTimeline(null);
        setNewTimelineData({ title: '', description: '' });
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to duplicate timeline');
      }
    } catch (error) {
      setError('Error duplicating timeline');
      console.error('Error duplicating timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTimeline = async (timeline: Timeline) => {
    if (!confirm(`Are you sure you want to delete "${timeline.title}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/timelines/${timeline._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTimelines();
        // If we deleted the current timeline, we need to switch to another one
        if (timeline._id === currentTimelineId && timelines.length > 1) {
          const remainingTimelines = timelines.filter(t => t._id !== timeline._id);
          if (remainingTimelines.length > 0) {
            onTimelineChange(remainingTimelines[0]._id);
          }
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete timeline');
      }
    } catch (error) {
      setError('Error deleting timeline');
      console.error('Error deleting timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, timeline: Timeline) => {
    event.stopPropagation();
    setSelectedTimeline(timeline);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedTimeline(null);
  };

  const openEditDialog = () => {
    if (selectedTimeline) {
      setNewTimelineData({
        title: selectedTimeline.title,
        description: selectedTimeline.description || '',
      });
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const openDuplicateDialog = () => {
    if (selectedTimeline) {
      setNewTimelineData({
        title: `${selectedTimeline.title} (Copy)`,
        description: '',
      });
      setDuplicateDialogOpen(true);
    }
    handleMenuClose();
  };

  const openCreateDialog = () => {
    setNewTimelineData({ title: '', description: '' });
    setCreateDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon />
            Timeline Manager
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Your Timelines</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openCreateDialog}
              disabled={loading}
            >
              New Timeline
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {timelines.map((timeline) => (
                <ListItem key={timeline._id} sx={{ px: 0 }}>
                  <ListItemButton
                    selected={timeline._id === currentTimelineId}
                    onClick={() => {
                      onTimelineChange(timeline._id);
                      onClose();
                    }}
                    sx={{ flex: 1, borderRadius: 1 }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {timeline.title}
                          {timeline._id === currentTimelineId && (
                            <Chip label="Current" size="small" color="primary" />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          {timeline.description && (
                            <Typography variant="body2" color="text.secondary" component="span" display="block">
                              {timeline.description}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" component="span" display="block">
                            Created: {formatDate(timeline.createdAt)} •
                            Updated: {formatDate(timeline.updatedAt)}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                  <IconButton
                    onClick={(e) => handleMenuClick(e, timeline)}
                    disabled={loading}
                  >
                    <MoreVert />
                  </IconButton>
                </ListItem>
              ))}

              {timelines.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No timelines found. Create your first timeline to get started.
                  </Typography>
                </Box>
              )}
            </List>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={openEditDialog}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={openDuplicateDialog}>
          <FileCopy sx={{ mr: 1 }} fontSize="small" />
          Save As...
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (selectedTimeline) {
              handleDeleteTimeline(selectedTimeline);
            }
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Timeline Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Timeline</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              required
              fullWidth
              label="Timeline Title"
              value={newTimelineData.title}
              onChange={(e) => setNewTimelineData({ ...newTimelineData, title: e.target.value })}
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description (Optional)"
              value={newTimelineData.description}
              onChange={(e) => setNewTimelineData({ ...newTimelineData, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTimeline} variant="contained" disabled={loading}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Timeline Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Timeline</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              required
              fullWidth
              label="Timeline Title"
              value={newTimelineData.title}
              onChange={(e) => setNewTimelineData({ ...newTimelineData, title: e.target.value })}
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description (Optional)"
              value={newTimelineData.description}
              onChange={(e) => setNewTimelineData({ ...newTimelineData, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditTimeline} variant="contained" disabled={loading}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Timeline Dialog */}
      <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Timeline As...</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will create a complete copy of "{selectedTimeline?.title}" including all events, entities, and locations.
          </Typography>
          <TextField
            required
            fullWidth
            label="New Timeline Title"
            value={newTimelineData.title}
            onChange={(e) => setNewTimelineData({ ...newTimelineData, title: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDuplicateTimeline} variant="contained" disabled={loading}>
            Create Copy
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}