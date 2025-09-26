'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
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
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Check if this is a text file that we should preview
  const isTextFile = (attachment: Attachment) => {
    return attachment.mimeType.startsWith('text/') ||
           attachment.mimeType === 'application/json' ||
           attachment.mimeType === 'application/xml' ||
           attachment.mimeType === 'application/javascript' ||
           attachment.mimeType === 'application/typescript' ||
           attachment.originalName.match(/\.(txt|md|json|xml|js|ts|jsx|tsx|css|scss|less|html|htm|csv|log|ini|conf|config|yml|yaml|toml)$/i);
  };

  // Fetch text content when dialog opens and it's a text file
  useEffect(() => {
    if (attachment && open && isTextFile(attachment) && !textContent && !loadingText) {
      fetchTextContent();
    }

    // Reset state when dialog closes
    if (!open) {
      setTextContent(null);
      setLoadingText(false);
      setTextError(null);
    }
  }, [open, attachment?._id]);

  if (!attachment) return null;

  const fetchTextContent = async () => {
    setLoadingText(true);
    setTextError(null);
    try {
      const response = await fetch(attachment.url);
      if (response.ok) {
        const text = await response.text();
        setTextContent(text);
      } else {
        setTextError('Failed to load file content');
      }
    } catch (error) {
      setTextError('Error loading file content');
    } finally {
      setLoadingText(false);
    }
  };

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
    } else if (isTextFile(attachment)) {
      return (
        <Box sx={{ height: '70vh', width: '100%', position: 'relative' }}>
          {loadingText ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Loading file content...</Typography>
            </Box>
          ) : textError ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column'
            }}>
              <Typography color="error" gutterBottom>
                {textError}
              </Typography>
              <Button onClick={fetchTextContent} variant="outlined" size="small">
                Retry
              </Button>
            </Box>
          ) : (
            <Box sx={{
              height: '100%',
              overflow: 'auto',
              backgroundColor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
            }}>
              <Box
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'text.primary',
                }}
              >
                {textContent}
              </Box>
            </Box>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '2px 6px',
              borderRadius: 1,
              fontSize: '0.7rem'
            }}
          >
            Text Preview
          </Typography>
        </Box>
      );
    } else if (attachment.mimeType === 'application/pdf') {
      return (
        <Box sx={{ height: '70vh', width: '100%', position: 'relative' }}>
          <Box
            component="iframe"
            src={`${attachment.url}#toolbar=1&navpanes=1&scrollbar=1`}
            sx={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 1,
            }}
            title={attachment.originalName}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '2px 6px',
              borderRadius: 1,
              fontSize: '0.7rem'
            }}
          >
            PDF Viewer
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