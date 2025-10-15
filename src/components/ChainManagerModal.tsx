'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Typography,
  Card,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, Circle } from '@mui/icons-material';

interface Chain {
  _id: string;
  name: string;
  color: string;
  description?: string;
  timelineId: string;
}

interface ChainManagerModalProps {
  open: boolean;
  onClose: () => void;
  timelineId: string | null;
  onChainCreated?: () => void;
}

const PRESET_COLORS = [
  '#1976d2', // blue
  '#d32f2f', // red
  '#388e3c', // green
  '#f57c00', // orange
  '#7b1fa2', // purple
  '#0288d1', // light blue
  '#c2185b', // pink
  '#689f38', // light green
  '#fbc02d', // yellow
  '#5d4037', // brown
  '#455a64', // blue grey
  '#e64a19', // deep orange
];

export default function ChainManagerModal({
  open,
  onClose,
  timelineId,
  onChainCreated,
}: ChainManagerModalProps) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingChainId, setEditingChainId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: PRESET_COLORS[0],
    description: '',
  });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (open && timelineId) {
      fetchChains();
    }
  }, [open, timelineId]);

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setEditingChainId(null);
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setFormData({
      name: '',
      color: PRESET_COLORS[0],
      description: '',
    });
    setError('');
  };

  const fetchChains = async () => {
    if (!timelineId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/chains?timelineId=${timelineId}`);
      if (response.ok) {
        const data = await response.json();
        setChains(data);
      }
    } catch (error) {
      console.error('Error fetching chains:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Chain name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      if (editingChainId) {
        // Update existing chain
        const response = await fetch(`/api/chains/${editingChainId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const updatedChain = await response.json();
          console.log('Chain updated successfully:', updatedChain);
          setChains(prev => prev.map(chain =>
            chain._id === editingChainId ? updatedChain : chain
          ));
          setShowForm(false);
          setEditingChainId(null);
          resetForm();
          onChainCreated?.();
        } else {
          const data = await response.json();
          console.error('Failed to update chain:', data);
          setError(data.error || 'Failed to update chain');
        }
      } else {
        // Create new chain
        const response = await fetch('/api/chains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            timelineId,
          }),
        });

        if (response.ok) {
          const newChain = await response.json();
          console.log('Chain created successfully:', newChain);
          setChains(prev => [...prev, newChain]);
          setShowForm(false);
          resetForm();
          onChainCreated?.();
        } else {
          const data = await response.json();
          console.error('Failed to create chain:', data);
          setError(data.error || 'Failed to create chain');
        }
      }
    } catch (error) {
      console.error('Error saving chain:', error);
      setError('Error saving chain');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (chain: Chain) => {
    setFormData({
      name: chain.name,
      color: chain.color,
      description: chain.description || '',
    });
    setEditingChainId(chain._id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (chainId: string) => {
    if (!confirm('Are you sure you want to delete this chain? It will be removed from all events.')) {
      return;
    }

    try {
      const response = await fetch(`/api/chains/${chainId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setChains(prev => prev.filter(chain => chain._id !== chainId));
        onChainCreated?.();
      } else {
        console.error('Failed to delete chain');
      }
    } catch (error) {
      console.error('Error deleting chain:', error);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingChainId(null);
    resetForm();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Manage Event Chains
        <Typography variant="body2" color="text.secondary">
          Create and organize chains to group related events
        </Typography>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Chain List */}
            {!showForm && (
              <>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowForm(true)}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  Create New Chain
                </Button>

                {chains.length === 0 ? (
                  <Alert severity="info">
                    No chains yet. Create your first chain to start organizing events.
                  </Alert>
                ) : (
                  <List>
                    {chains.map((chain) => (
                      <ListItem
                        key={chain._id}
                        secondaryAction={
                          <Box>
                            <IconButton
                              edge="end"
                              onClick={() => handleEdit(chain)}
                              sx={{ mr: 0.5 }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              edge="end"
                              onClick={() => handleDelete(chain._id)}
                              sx={{ color: 'error.main' }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                        }}
                      >
                        <Circle
                          sx={{
                            color: chain.color,
                            fontSize: 24,
                            mr: 2,
                          }}
                        />
                        <ListItemText
                          primary={chain.name}
                          secondary={chain.description}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </>
            )}

            {/* Chain Form */}
            {showForm && (
              <Box component="form" onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  label="Chain Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  sx={{ mb: 2 }}
                  autoFocus
                />

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description (Optional)"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  sx={{ mb: 2 }}
                />

                <Typography variant="body2" gutterBottom>
                  Color
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {PRESET_COLORS.map((color) => (
                    <Box
                      key={color}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: color,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: formData.color === color ? '3px solid' : '2px solid',
                        borderColor: formData.color === color ? 'primary.main' : 'transparent',
                        '&:hover': {
                          opacity: 0.8,
                        },
                      }}
                    />
                  ))}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button onClick={handleCancel} disabled={creating}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={creating || !formData.name.trim()}
                  >
                    {creating ? (
                      <CircularProgress size={20} />
                    ) : editingChainId ? (
                      'Update'
                    ) : (
                      'Create'
                    )}
                  </Button>
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
