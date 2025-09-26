'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Tab, Tabs, IconButton, Paper, Tooltip, Button } from '@mui/material';
import { Close, DragIndicator, ChevronRight } from '@mui/icons-material';

interface Panel {
  id: string;
  title: string;
  component: React.ReactNode;
  isVisible: boolean;
  width: number;
  minWidth: number;
}

interface ResizablePanelsProps {
  panels: Panel[];
  onPanelVisibilityChange: (panelId: string, isVisible: boolean) => void;
  onPanelReorder: (dragIndex: number, hoverIndex: number) => void;
}

export default function ResizablePanels({
  panels,
  onPanelVisibilityChange,
  onPanelReorder,
}: ResizablePanelsProps) {
  const [panelWidths, setPanelWidths] = useState<{ [key: string]: number }>({});
  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const visiblePanels = useMemo(() =>
    panels.filter(panel => panel.isVisible),
    [panels]
  );

  const collapsedPanels = useMemo(() =>
    panels.filter(panel => !panel.isVisible),
    [panels]
  );

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const collapsedPanelWidth = collapsedPanels.length > 0 ? 40 : 0; // Width for collapsed panel buttons
      const availableWidth = containerWidth - collapsedPanelWidth;

      setPanelWidths(prev => {
        const newWidths = { ...prev };
        let hasChanges = false;

        // Calculate proportional widths to fill the container
        const totalPreferredWidth = visiblePanels.reduce((sum, panel) => sum + (prev[panel.id] || panel.width), 0);

        visiblePanels.forEach(panel => {
          const preferredWidth = prev[panel.id] || panel.width;
          const proportionalWidth = Math.max(
            panel.minWidth,
            (preferredWidth / totalPreferredWidth) * availableWidth
          );

          if (newWidths[panel.id] !== proportionalWidth) {
            newWidths[panel.id] = proportionalWidth;
            hasChanges = true;
          }
        });

        return hasChanges ? newWidths : prev;
      });
    }
  }, [visiblePanels, collapsedPanels]);

  // Handle window resize to maintain full width
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const collapsedPanelWidth = collapsedPanels.length > 0 ? 40 : 0;
        const availableWidth = containerWidth - collapsedPanelWidth;

        setPanelWidths(prev => {
          const newWidths = { ...prev };
          const currentTotal = Object.values(prev).reduce((sum, width) => sum + width, 0);

          if (currentTotal !== availableWidth) {
            const scale = availableWidth / currentTotal;
            visiblePanels.forEach(panel => {
              newWidths[panel.id] = Math.max(panel.minWidth, prev[panel.id] * scale);
            });
          }

          return newWidths;
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visiblePanels, collapsedPanels]);

  const handleResize = (panelId: string, newWidth: number) => {
    if (!containerRef.current) return;

    setPanelWidths(prev => {
      const newWidths = { ...prev };
      const minWidth = visiblePanels.find(p => p.id === panelId)?.minWidth || 200;
      const clampedWidth = Math.max(minWidth, newWidth);

      const containerWidth = containerRef.current!.clientWidth;
      const collapsedPanelWidth = collapsedPanels.length > 0 ? 40 : 0;
      const availableWidth = containerWidth - collapsedPanelWidth;

      // Calculate how much width changed
      const widthDelta = clampedWidth - (prev[panelId] || 0);

      // Find other panels to adjust
      const otherPanels = visiblePanels.filter(p => p.id !== panelId);

      if (otherPanels.length > 0) {
        // Distribute the width change among other panels
        const adjustmentPerPanel = -widthDelta / otherPanels.length;

        otherPanels.forEach(panel => {
          const currentWidth = prev[panel.id] || panel.width;
          const newPanelWidth = Math.max(panel.minWidth, currentWidth + adjustmentPerPanel);
          newWidths[panel.id] = newPanelWidth;
        });
      }

      newWidths[panelId] = clampedWidth;

      // Ensure total width matches container
      const totalWidth = Object.values(newWidths).reduce((sum, w) => sum + w, 0);
      if (Math.abs(totalWidth - availableWidth) > 1) {
        const scale = availableWidth / totalWidth;
        Object.keys(newWidths).forEach(id => {
          const panel = visiblePanels.find(p => p.id === id);
          if (panel) {
            newWidths[id] = Math.max(panel.minWidth, newWidths[id] * scale);
          }
        });
      }

      return newWidths;
    });
  };

  const handleDismiss = (panelId: string) => {
    onPanelVisibilityChange(panelId, false);
  };

  const handleExpand = (panelId: string) => {
    onPanelVisibilityChange(panelId, true);
  };

  const handleMouseDown = (e: React.MouseEvent, panelId: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidths[panelId] || 300;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX);
      handleResize(panelId, newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (visiblePanels.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        No panels to display
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Visible Panels */}
      {visiblePanels.map((panel, index) => (
        <Paper
          key={panel.id}
          elevation={1}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: panel.minWidth,
            width: panelWidths[panel.id] || panel.width,
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 0,
            borderRight: index < visiblePanels.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          {/* Panel Header with Tabs */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
              minHeight: 48,
              bgcolor: 'grey.50'
            }}
          >
            <IconButton
              size="small"
              sx={{ cursor: 'grab', p: 1 }}
              onMouseDown={(e) => {
                e.preventDefault();
                setDraggedPanel(panel.id);
              }}
            >
              <DragIndicator fontSize="small" />
            </IconButton>

            <Tabs
              value={0}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flex: 1, minHeight: 'auto' }}
            >
              <Tab
                label={panel.title}
                sx={{ minHeight: 'auto', py: 1, px: 2 }}
              />
            </Tabs>

            <IconButton
              size="small"
              onClick={() => handleDismiss(panel.id)}
              sx={{ mr: 1 }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Panel Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {panel.component}
          </Box>

          {/* Resize Handle */}
          {index < visiblePanels.length - 1 && (
            <Box
              onMouseDown={(e) => handleMouseDown(e, panel.id)}
              sx={{
                position: 'absolute',
                right: -4,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: 'col-resize',
                bgcolor: 'transparent',
                '&:hover': {
                  bgcolor: 'primary.main',
                  opacity: 0.3
                },
                zIndex: 10
              }}
            />
          )}
        </Paper>
      ))}

      {/* Collapsed Panels Area */}
      {collapsedPanels.length > 0 && (
        <Box
          sx={{
            width: 40,
            height: '100%',
            backgroundColor: 'grey.100',
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 1,
            gap: 1,
          }}
        >
          {collapsedPanels.map((panel) => (
            <Tooltip key={panel.id} title={`Expand ${panel.title}`} placement="left">
              <Button
                variant="text"
                size="small"
                onClick={() => handleExpand(panel.id)}
                sx={{
                  minWidth: 32,
                  width: 32,
                  height: 32,
                  p: 0,
                  backgroundColor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <ChevronRight fontSize="small" />
              </Button>
            </Tooltip>
          ))}
        </Box>
      )}
    </Box>
  );
}