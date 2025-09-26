'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { Close, Download } from '@mui/icons-material';

interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: 'photo' | 'video' | 'audio' | 'document' | 'other';
}

interface AttachmentViewerProps {
  open: boolean;
  onClose: () => void;
  attachment: Attachment | null;
}

export default function AttachmentViewer({ open, onClose, attachment }: AttachmentViewerProps) {
  if (!attachment) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderContent = () => {
    if (attachment.mimeType.startsWith('image/')) {
      return (
        <Box
          component="img"
          src={attachment.url}
          alt={attachment.originalName}
          sx={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto',
          }}
        />
      );
    } else if (attachment.mimeType.startsWith('video/')) {
      return (
        <Box
          component="video"
          controls
          sx={{
            maxWidth: '100%',
            maxHeight: '70vh',
            display: 'block',
            margin: '0 auto',
          }}
        >
          <source src={attachment.url} type={attachment.mimeType} />
          Your browser does not support the video tag.
        </Box>
      );
    } else if (attachment.mimeType.startsWith('audio/')) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Box
            sx={{
              fontSize: '4rem',
              mb: 2,
            }}
          >
            🎵
          </Box>
          <Box
            component="audio"
            controls
            sx={{
              width: '100%',
              maxWidth: 400,
            }}
          >
            <source src={attachment.url} type={attachment.mimeType} />
            Your browser does not support the audio tag.
          </Box>
        </Box>
      );
    } else if (attachment.mimeType === 'application/pdf') {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Box
            sx={{
              fontSize: '4rem',
              mb: 2,
            }}
          >
            📄
          </Box>
          <Typography variant="body1" gutterBottom>
            PDF files cannot be previewed in this modal.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click download to view the file.
          </Typography>
        </Box>
      );
    } else {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Box
            sx={{
              fontSize: '4rem',
              mb: 2,
            }}
          >
            📎
          </Box>
          <Typography variant="body1" gutterBottom>
            This file type cannot be previewed.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click download to view the file.
          </Typography>
        </Box>
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {attachment.originalName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(attachment.size)} • {attachment.type}
          </Typography>
        </Box>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 2 }}>
          {renderContent()}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleDownload}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}