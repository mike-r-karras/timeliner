'use client';

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import TimelineInterface from '@/components/TimelineInterface';

interface SharePageProps {
  params: {
    shareId: string;
  };
}

export default function SharePage({ params }: SharePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);

  useEffect(() => {
    const validateShare = async () => {
      try {
        // Verify share link is valid by fetching timeline
        const response = await fetch(`/api/share/${params.shareId}/timeline`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Share link not found or has been revoked');
          } else if (response.status === 410) {
            setError('Share link has expired');
          } else {
            setError('Failed to load shared timeline');
          }
          setLoading(false);
          return;
        }

        const timeline = await response.json();
        setTimelineId(timeline._id);
        setLoading(false);
      } catch (err) {
        console.error('Error validating share link:', err);
        setError('Failed to load shared timeline');
        setLoading(false);
      }
    };

    validateShare();
  }, [params.shareId]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Unable to Load Timeline
          </Typography>
          <Typography>{error}</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <TimelineInterface
        userId="shared"
        shareId={params.shareId}
        readOnly={true}
      />
    </Box>
  );
}
