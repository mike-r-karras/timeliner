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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  RadioGroup,
  FormControlLabel,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { Link as LinkIcon, AttachFile } from '@mui/icons-material';

interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  type: 'photo' | 'video' | 'audio' | 'document' | 'other';
  date?: string;
  creator?: string;
  creditLine?: string;
}

interface Link {
  _id: string;
  title: string;
  url: string;
}

interface Footnote {
  number: number;
  type: 'link' | 'attachment';
  referenceId: string;
  pageRange?: string;
  customSource?: string;
  date?: string;
}

interface FootnoteModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (footnote: Omit<Footnote, 'number'>) => void;
  attachments: Attachment[];
  links: Link[];
  editingFootnote?: Footnote | null;
}

export default function FootnoteModal({
  open,
  onClose,
  onSave,
  attachments,
  links,
  editingFootnote,
}: FootnoteModalProps) {
  const [activeTab, setActiveTab] = useState<'attachments' | 'links'>('attachments');
  const [selectedId, setSelectedId] = useState<string>('');
  const [pageRange, setPageRange] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingFootnote) {
        // Populate form with existing footnote data
        setActiveTab(editingFootnote.type === 'link' ? 'links' : 'attachments');
        setSelectedId(editingFootnote.referenceId);
        setPageRange(editingFootnote.pageRange || '');
        setCustomSource(editingFootnote.customSource || '');
        setDate(editingFootnote.date || '');
      } else {
        // Reset form
        setActiveTab('attachments');
        setSelectedId('');
        setPageRange('');
        setCustomSource('');
        setDate('');
      }
      setError('');
    }
  }, [open, editingFootnote]);

  const getDefaultSource = () => {
    if (activeTab === 'attachments' && selectedId) {
      const attachment = attachments.find(a => a._id === selectedId);
      if (attachment) {
        // Use type as default source
        return attachment.type;
      }
    }
    return '';
  };

  const handleSave = () => {
    if (!selectedId) {
      setError('Please select an attachment or link to reference');
      return;
    }

    const footnote: Omit<Footnote, 'number'> = {
      type: activeTab === 'links' ? 'link' : 'attachment',
      referenceId: selectedId,
      pageRange: pageRange.trim() || undefined,
      customSource: customSource.trim() || undefined,
      date: date.trim() || undefined,
    };

    onSave(footnote);
    onClose();
  };

  const selectedAttachments = activeTab === 'attachments' ? attachments : [];
  const selectedLinks = activeTab === 'links' ? links : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableEnforceFocus
      disableRestoreFocus
    >
      <DialogTitle>
        {editingFootnote ? 'Edit Footnote' : 'Add Footnote'}
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tab Selection */}
        <Tabs
          value={activeTab}
          onChange={(_, value) => {
            setActiveTab(value);
            setSelectedId('');
          }}
          sx={{ mb: 2 }}
        >
          <Tab label={`Attachments (${attachments.length})`} value="attachments" />
          <Tab label={`Links (${links.length})`} value="links" />
        </Tabs>

        {/* Reference Selection */}
        <Box sx={{ mb: 2, maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {activeTab === 'attachments' && (
            <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {attachments.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No attachments available. Add attachments to this event first.
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {attachments.map((attachment) => (
                    <ListItem key={attachment._id} disablePadding>
                      <ListItemButton onClick={() => setSelectedId(attachment._id)}>
                        <ListItemIcon>
                          <Radio
                            value={attachment._id}
                            edge="start"
                            checked={selectedId === attachment._id}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <AttachFile sx={{ mr: 1, fontSize: 20 }} />
                        <ListItemText
                          primary={attachment.originalName}
                          secondary={`${attachment.type}${attachment.date ? ` • ${new Date(attachment.date).toLocaleDateString()}` : ''}`}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </RadioGroup>
          )}

          {activeTab === 'links' && (
            <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {links.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No links available. Add links to this event first.
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {links.map((link) => (
                    <ListItem key={link._id} disablePadding>
                      <ListItemButton onClick={() => setSelectedId(link._id)}>
                        <ListItemIcon>
                          <Radio
                            value={link._id}
                            edge="start"
                            checked={selectedId === link._id}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <LinkIcon sx={{ mr: 1, fontSize: 20 }} />
                        <ListItemText
                          primary={link.title}
                          secondary={link.url}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </RadioGroup>
          )}
        </Box>

        {/* Page Range */}
        <TextField
          fullWidth
          label="Page Range (Optional)"
          placeholder="e.g., pp. 1-4, 6"
          value={pageRange}
          onChange={(e) => setPageRange(e.target.value)}
          sx={{ mb: 2 }}
          helperText="Enter page numbers or ranges (e.g., pp. 1-4, 6)"
        />

        {/* Date */}
        <TextField
          fullWidth
          label="Date (Optional)"
          placeholder="e.g., 1985, Jan 1985, 1/14/1985, 1985-01-14 10:30"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          sx={{ mb: 2 }}
          helperText="Enter date in any format (year, month/year, full date, with time)"
        />

        {/* Custom Source */}
        <TextField
          fullWidth
          label="Source (Optional)"
          placeholder={getDefaultSource() || "e.g., Author, Publisher, Speaker"}
          value={customSource}
          onChange={(e) => setCustomSource(e.target.value)}
          helperText={`Leave blank to use default: ${getDefaultSource() || 'N/A'}`}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!selectedId}
        >
          {editingFootnote ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
