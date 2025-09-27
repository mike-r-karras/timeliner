'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Switch,
  Chip,
  Box,
  Typography,
  Autocomplete,
} from '@mui/material';

interface ConnectionModalProps {
  open: boolean;
  onClose: () => void;
  sourceType: 'event' | 'entity';
  sourceName: string;
  targetType: 'event' | 'entity';
  targetName: string;
  onSave: (connection: {
    relationshipType: string;
    tags: string[];
    description?: string;
    startArrow: 'none' | 'arrow';
    endArrow: 'none' | 'arrow';
  }) => void;
}

const PREDEFINED_RELATIONSHIP_TYPES = [
  // Family relationships
  'familial',
  'parent',
  'child',
  'sibling',
  'spouse',
  'relative',

  // Professional relationships
  'employment',
  'employer',
  'employee',
  'colleague',
  'business_partner',
  'client',
  'consultant',

  // Social relationships
  'friend',
  'acquaintance',
  'mentor',
  'student',
  'neighbor',

  // Organizational relationships
  'member',
  'leader',
  'founder',
  'board_member',
  'volunteer',

  // Other common relationships
  'owns',
  'created',
  'associated_with',
  'influenced',
  'supported',
  'opposed',
  'collaborated',
  'competed',

  'other'
];

export default function ConnectionModal({
  open,
  onClose,
  sourceType,
  sourceName,
  targetType,
  targetName,
  onSave
}: ConnectionModalProps) {
  const [relationshipType, setRelationshipType] = useState('');
  const [customRelationshipType, setCustomRelationshipType] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [startArrow, setStartArrow] = useState<'none' | 'arrow'>('none');
  const [endArrow, setEndArrow] = useState<'none' | 'arrow'>('none');

  const handleSave = () => {
    const finalRelationshipType = relationshipType === 'other' ? customRelationshipType : relationshipType;

    if (!finalRelationshipType.trim()) {
      return; // Don't save without a relationship type
    }

    onSave({
      relationshipType: finalRelationshipType.trim(),
      tags,
      description: description.trim() || undefined,
      startArrow,
      endArrow,
    });

    // Reset form
    setRelationshipType('');
    setCustomRelationshipType('');
    setTags([]);
    setDescription('');
    setStartArrow('none');
    setEndArrow('none');
  };

  const handleClose = () => {
    // Reset form on close
    setRelationshipType('');
    setCustomRelationshipType('');
    setTags([]);
    setDescription('');
    setStartArrow('none');
    setEndArrow('none');
    onClose();
  };

  const isFormValid = () => {
    const finalRelationshipType = relationshipType === 'other' ? customRelationshipType : relationshipType;
    return finalRelationshipType.trim() !== '';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Connection</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{sourceName}</strong> ({sourceType}) → <strong>{targetName}</strong> ({targetType})
          </Typography>
        </Box>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Relationship Type*</InputLabel>
          <Select
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            label="Relationship Type*"
          >
            {PREDEFINED_RELATIONSHIP_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {relationshipType === 'other' && (
          <TextField
            fullWidth
            label="Custom Relationship Type*"
            value={customRelationshipType}
            onChange={(e) => setCustomRelationshipType(e.target.value)}
            placeholder="Enter custom relationship type"
            sx={{ mb: 2 }}
          />
        )}

        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={tags}
          onChange={(_, newValue) => setTags(newValue as string[])}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...chipProps } = getTagProps({ index });
              return (
                <Chip key={index} variant="outlined" label={option} {...chipProps} />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Tags"
              placeholder="Add tags (press Enter)"
              helperText="Press Enter to add tags"
            />
          )}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Description"
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of the relationship"
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Arrow Direction
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={startArrow === 'arrow'}
                  onChange={(e) => setStartArrow(e.target.checked ? 'arrow' : 'none')}
                />
              }
              label={`Arrow to ${sourceName}`}
            />
          </FormGroup>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={endArrow === 'arrow'}
                  onChange={(e) => setEndArrow(e.target.checked ? 'arrow' : 'none')}
                />
              }
              label={`Arrow to ${targetName}`}
            />
          </FormGroup>
        </Box>

        <Typography variant="caption" color="text.secondary">
          * Required fields
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!isFormValid()}
        >
          Create Connection
        </Button>
      </DialogActions>
    </Dialog>
  );
}