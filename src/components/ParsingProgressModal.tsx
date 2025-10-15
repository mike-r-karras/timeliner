import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  LinearProgress,
  Fade,
} from '@mui/material';
import loadingMessages from '@/assets/loading_messages';

interface ParsingProgressModalProps {
  open: boolean;
  tokenCount: number; // Estimated token count of content being parsed
  parsingType: 'url' | 'file';
  fileName?: string;
}

export default function ParsingProgressModal({
  open,
  tokenCount,
  parsingType,
  fileName,
}: ParsingProgressModalProps) {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(loadingMessages[0]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(10000); // Default 10 seconds
  const [showMessage, setShowMessage] = useState(true);

  // Fetch historical performance data on mount
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await fetch(`/api/parsing-performance?parsingType=${parsingType}`);
        if (response.ok) {
          const data = await response.json();
          if (data.hasData && data.avgTokensPerSecond > 0) {
            // Estimate duration based on token count and average performance
            const estimatedMs = (tokenCount / data.avgTokensPerSecond) * 1000;
            setEstimatedDuration(estimatedMs);
            console.log('Estimated parsing duration:', estimatedMs, 'ms for', tokenCount, 'tokens');
          }
        }
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
      }
    };

    if (open) {
      fetchPerformanceData();
    }
  }, [open, tokenCount, parsingType]);

  // Update progress based on elapsed time
  useEffect(() => {
    if (!open) {
      setProgress(0);
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Calculate progress (cap at 95% until actually done)
      const calculatedProgress = Math.min((elapsed / estimatedDuration) * 100, 95);
      setProgress(calculatedProgress);
    }, 100); // Update every 100ms for smooth progress

    return () => clearInterval(interval);
  }, [open, estimatedDuration]);

  // Rotate loading messages every 10 seconds with fade animation (random order)
  useEffect(() => {
    if (!open) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      // Fade out
      setShowMessage(false);

      setTimeout(() => {
        // Pick a random message different from the current one
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * loadingMessages.length);
        } while (newIndex === messageIndex && loadingMessages.length > 1);

        setMessageIndex(newIndex);
        setCurrentMessage(loadingMessages[newIndex]);

        // Fade in
        setShowMessage(true);
      }, 500); // Half-second fade out before changing
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval);
  }, [open, messageIndex]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderRadius: 2,
          p: 3,
        }
      }}
    >
      <DialogContent>
        <Box sx={{ textAlign: 'center' }}>
          {/* Title */}
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
            {parsingType === 'file' ? 'Parsing File' : 'Parsing URL'}
          </Typography>

          {/* File name if provided */}
          {fileName && (
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
              {fileName}
            </Typography>
          )}

          {/* Progress bar */}
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  bgcolor: 'primary.main',
                  transition: 'transform 0.1s linear',
                },
              }}
            />
          </Box>

          {/* Progress percentage and time */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress)}% complete
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatTime(elapsedTime)} elapsed
            </Typography>
          </Box>

          {/* Rotating loading message with fade animation */}
          <Box sx={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Fade in={showMessage} timeout={500}>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{
                  fontStyle: 'italic',
                  fontSize: '0.95rem',
                }}
              >
                {currentMessage}
              </Typography>
            </Fade>
          </Box>

          {/* Technical details */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Processing ~{tokenCount.toLocaleString()} tokens
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
