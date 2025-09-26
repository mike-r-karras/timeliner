'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  Slider,
  Card,
  CardContent,
  Chip,
  IconButton,
  Rating,
} from '@mui/material';
import { Edit, ZoomIn, ZoomOut, Add } from '@mui/icons-material';
import { format } from 'date-fns';
import AttachmentViewer from './AttachmentViewer';

interface Event {
  _id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  importance: number;
  thumbnailUrl?: string;
}

interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: 'photo' | 'video' | 'audio' | 'document' | 'other';
}

interface TimelinePanelProps {
  timelineId?: string | null;
  selectedItems?: any;
  onSelection?: (type: 'event' | 'entity' | 'location', ids: string[], append?: boolean) => void;
  onEditEvent?: (eventId: string) => void;
  onAddEvent?: () => void;
}

export default function TimelinePanel({ timelineId, selectedItems, onSelection, onEditEvent, onAddEvent }: TimelinePanelProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventAttachments, setEventAttachments] = useState<Record<string, Attachment[]>>({});
  const [timelineTitle, setTimelineTitle] = useState('Untitled');
  const [zoomLevel, setZoomLevel] = useState(50);
  const [editingTitle, setEditingTitle] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (timelineId && isClient) {
      fetchTimelineData();
    }
  }, [timelineId, isClient]);

  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      const [timelineResponse, eventsResponse] = await Promise.all([
        fetch(`/api/timelines/${timelineId}`),
        fetch(`/api/events?timelineId=${timelineId}`)
      ]);

      if (timelineResponse.ok) {
        const timeline = await timelineResponse.json();
        setTimelineTitle(timeline.title);
      }

      if (eventsResponse.ok) {
        const eventData = await eventsResponse.json();
        const sortedEvents = eventData.sort((a: Event, b: Event) =>
          new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        );
        setEvents(sortedEvents);

        // Fetch attachments for each event
        const attachmentsMap: Record<string, Attachment[]> = {};
        for (const event of sortedEvents) {
          try {
            const attachResponse = await fetch(`/api/attachments?eventId=${event._id}`);
            if (attachResponse.ok) {
              const attachments = await attachResponse.json();
              attachmentsMap[event._id] = attachments;
            }
          } catch (error) {
            console.error(`Error fetching attachments for event ${event._id}:`, error);
          }
        }
        setEventAttachments(attachmentsMap);
      }
    } catch (error) {
      console.error('Error fetching timeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTitleUpdate = async (newTitle: string) => {
    try {
      const response = await fetch(`/api/timelines/${timelineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        setTimelineTitle(newTitle);
      }
    } catch (error) {
      console.error('Error updating timeline title:', error);
    }
  };

  const handleEventClick = (eventId: string, shiftKey: boolean) => {
    if (onSelection) {
      onSelection('event', [eventId], shiftKey);
    }
  };

  const isEventSelected = (eventId: string) => {
    return selectedItems?.events?.includes(eventId) || false;
  };

  const handleAttachmentClick = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    setSelectedAttachment(null);
  };

  // Timeline calculation utilities
  const getTimeRange = () => {
    if (events.length === 0) return { start: new Date(), end: new Date(), duration: 0 };

    const times = events.map(e => new Date(e.startDateTime).getTime());
    const start = new Date(Math.min(...times));
    const end = new Date(Math.max(...times));
    const duration = end.getTime() - start.getTime();

    // Add padding (10% on each side)
    const padding = duration * 0.1;
    const paddedStart = new Date(start.getTime() - padding);
    const paddedEnd = new Date(end.getTime() + padding);

    return {
      start: paddedStart,
      end: paddedEnd,
      duration: paddedEnd.getTime() - paddedStart.getTime()
    };
  };

  const getEventPosition = (eventTime: string, timeRange: ReturnType<typeof getTimeRange>) => {
    if (timeRange.duration === 0) return 0;
    const eventTimestamp = new Date(eventTime).getTime();
    const relativeTime = eventTimestamp - timeRange.start.getTime();
    return (relativeTime / timeRange.duration) * 100; // Return as percentage
  };

  const generateTimeMarks = (timeRange: ReturnType<typeof getTimeRange>) => {
    const marks: Array<{ position: number; label: string; isMainMark: boolean }> = [];
    const { duration, start, end } = timeRange;

    // Determine appropriate intervals for round dates
    let mainInterval: number;
    let subInterval: number;
    let formatMain: (date: Date) => string;
    let formatSub: (date: Date) => string;

    // Safe date formatting functions that work consistently on server and client
    const safeTimeFormat = (date: Date, includeMinutes = false) => {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return includeMinutes ? `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}` : `${displayHours} ${ampm}`;
    };

    const safeDateFormat = (date: Date, includeYear = false) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      return includeYear ? `${month} ${day}, ${year}` : `${month} ${day}`;
    };

    if (duration < 1000 * 60 * 60 * 2) { // Less than 2 hours - show 30min/10min
      mainInterval = 1000 * 60 * 30; // 30 minutes
      subInterval = 1000 * 60 * 10; // 10 minutes
      formatMain = (date) => safeTimeFormat(date, true);
      formatSub = (date) => ':' + date.getMinutes().toString().padStart(2, '0');
    } else if (duration < 1000 * 60 * 60 * 24) { // Less than 1 day - show 2hr/1hr
      mainInterval = 1000 * 60 * 60 * 2; // 2 hours
      subInterval = 1000 * 60 * 60; // 1 hour
      formatMain = (date) => safeTimeFormat(date);
      formatSub = (date) => safeTimeFormat(date);
    } else if (duration < 1000 * 60 * 60 * 24 * 14) { // Less than 2 weeks - show days
      mainInterval = 1000 * 60 * 60 * 24 * 7; // 1 week
      subInterval = 1000 * 60 * 60 * 24; // 1 day
      formatMain = (date) => safeDateFormat(date);
      formatSub = (date) => date.getDate().toString();
    } else if (duration < 1000 * 60 * 60 * 24 * 365) { // Less than 1 year - show months
      mainInterval = 1000 * 60 * 60 * 24 * 30 * 3; // 3 months (quarters)
      subInterval = 1000 * 60 * 60 * 24 * 30; // 1 month
      formatMain = (date) => safeDateFormat(date, true);
      formatSub = (date) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
    } else if (duration < 1000 * 60 * 60 * 24 * 365 * 10) { // Less than 10 years - show years
      mainInterval = 1000 * 60 * 60 * 24 * 365 * 5; // 5 years
      subInterval = 1000 * 60 * 60 * 24 * 365; // 1 year
      formatMain = (date) => date.getFullYear().toString();
      formatSub = (date) => "'" + date.getFullYear().toString().slice(-2);
    } else { // Show decades
      mainInterval = 1000 * 60 * 60 * 24 * 365 * 10; // 10 years (decade)
      subInterval = 1000 * 60 * 60 * 24 * 365 * 5; // 5 years
      formatMain = (date) => date.getFullYear().toString();
      formatSub = (date) => "'" + date.getFullYear().toString().slice(-2);
    }

    // Scale intervals based on zoom (but cap the number of marks)
    const zoomFactor = Math.max(0.5, Math.min(2, zoomLevel / 50));
    const adjustedMainInterval = mainInterval / zoomFactor;
    const adjustedSubInterval = subInterval / zoomFactor;

    // Add main marks (labeled)
    let currentTime = Math.ceil(start.getTime() / adjustedMainInterval) * adjustedMainInterval;
    while (currentTime <= end.getTime()) {
      const position = ((currentTime - start.getTime()) / duration) * 100;
      marks.push({
        position,
        label: formatMain(new Date(currentTime)),
        isMainMark: true
      });
      currentTime += adjustedMainInterval;
    }

    // Add sub marks (minimal labels) - always add them to fill the timeline
    currentTime = Math.ceil(start.getTime() / adjustedSubInterval) * adjustedSubInterval;
    while (currentTime <= end.getTime()) {
      const position = ((currentTime - start.getTime()) / duration) * 100;

      // Don't add sub mark if there's already a main mark at this position
      const hasMainMark = marks.some(mark => Math.abs(mark.position - position) < 2);
      if (!hasMainMark) {
        marks.push({
          position,
          label: formatSub(new Date(currentTime)),
          isMainMark: false
        });
      }
      currentTime += adjustedSubInterval;
    }

    // Add even more granular marks for better timeline filling
    if (marks.length < 15) {
      const microInterval = adjustedSubInterval / 2;
      let formatMicro: (date: Date) => string;

      if (duration < 1000 * 60 * 60 * 2) { // Less than 2 hours
        formatMicro = () => '·';
      } else if (duration < 1000 * 60 * 60 * 24) { // Less than 1 day
        formatMicro = () => '·';
      } else if (duration < 1000 * 60 * 60 * 24 * 14) { // Less than 2 weeks
        formatMicro = () => '·';
      } else {
        formatMicro = () => '·';
      }

      currentTime = Math.ceil(start.getTime() / microInterval) * microInterval;
      while (currentTime <= end.getTime()) {
        const position = ((currentTime - start.getTime()) / duration) * 100;

        // Don't add micro mark if there's already a main or sub mark at this position
        const hasExistingMark = marks.some(mark => Math.abs(mark.position - position) < 1.5);
        if (!hasExistingMark) {
          marks.push({
            position,
            label: formatMicro(new Date(currentTime)),
            isMainMark: false
          });
        }
        currentTime += microInterval;
      }
    }

    // Sort by position and limit to reasonable number of marks
    return marks.sort((a, b) => a.position - b.position).slice(0, 25);
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Timeline Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        {editingTitle ? (
          <TextField
            fullWidth
            value={timelineTitle}
            onChange={(e) => setTimelineTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              handleTitleUpdate(timelineTitle);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                setEditingTitle(false);
                handleTitleUpdate(timelineTitle);
              }
            }}
            autoFocus
            variant="standard"
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              {timelineTitle}
            </Typography>
            <IconButton size="small" onClick={() => setEditingTitle(true)}>
              <Edit fontSize="small" />
            </IconButton>
            {onAddEvent && (
              <IconButton
                size="small"
                onClick={onAddEvent}
                sx={{ color: 'primary.main' }}
              >
                <Add fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}

        {/* Zoom Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <ZoomOut fontSize="small" />
          <Slider
            value={zoomLevel}
            onChange={(_, value) => setZoomLevel(value as number)}
            sx={{ flex: 1, mx: 1 }}
            min={10}
            max={100}
            size="small"
          />
          <ZoomIn fontSize="small" />
          <Typography variant="caption" sx={{ ml: 1 }}>
            Zoom: {zoomLevel}%
          </Typography>
        </Box>
      </Box>

      {/* Vertical Timeline */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {!isClient ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              Loading timeline...
            </Typography>
          </Box>
        ) : events.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No events in this timeline. Click the + button to add your first event.
            </Typography>
          </Box>
        ) : (() => {
          const timeRange = getTimeRange();
          const timeMarks = generateTimeMarks(timeRange);
          const timelineHeight = Math.max(600, 1000 * (zoomLevel / 50));

          return (
            <Box sx={{ position: 'relative', height: timelineHeight, minHeight: '100%', px: 2 }}>
              {/* Central Timeline Line */}
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: 'divider',
                  transform: 'translateX(-50%)',
                  zIndex: 1,
                }}
              />

              {/* Time Scale Marks */}
              {timeMarks.map((mark, index) => {
                const isMicroMark = mark.label === '·';
                return (
                  <Box key={index}>
                    {/* Scale mark */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: mark.isMainMark ? 'calc(50% - 15px)' :
                               isMicroMark ? 'calc(50% - 2px)' : 'calc(50% - 10px)',
                        top: `${mark.position}%`,
                        width: mark.isMainMark ? 30 : isMicroMark ? 4 : 20,
                        height: isMicroMark ? 2 : 2,
                        backgroundColor: 'text.secondary',
                        opacity: isMicroMark ? 0.4 : 1,
                        zIndex: 2,
                      }}
                    />
                    {/* Scale label */}
                    {!isMicroMark && (
                      <Typography
                        variant={mark.isMainMark ? 'caption' : 'overline'}
                        sx={{
                          position: 'absolute',
                          left: 'calc(50% + 20px)',
                          top: `${mark.position}%`,
                          transform: 'translateY(-50%)',
                          color: 'text.secondary',
                          fontSize: mark.isMainMark ? '0.75rem' : '0.65rem',
                          fontWeight: mark.isMainMark ? 'medium' : 'normal',
                          whiteSpace: 'nowrap',
                          zIndex: 2,
                        }}
                      >
                        {mark.label}
                      </Typography>
                    )}
                  </Box>
                );
              })}

              {/* Events */}
              {events.map((event) => {
                const eventPosition = getEventPosition(event.startDateTime, timeRange);
                const isSelected = isEventSelected(event._id);

                return (
                  <Box
                    key={event._id}
                    sx={{
                      position: 'absolute',
                      top: `${eventPosition}%`,
                      left: 8,
                      right: 8,
                      transform: 'translateY(-50%)',
                      zIndex: 3,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* Event card */}
                    <Card
                      sx={{
                        width: '100%',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        '&:hover': { elevation: 2 },
                        backgroundColor: isSelected ? 'primary.50' : 'background.paper',
                      }}
                      onClick={(e) => handleEventClick(event._id, e.shiftKey)}
                    >
                      <CardContent sx={{ py: isSelected ? 1 : 0.5, px: 2, transition: 'all 0.2s ease-in-out' }}>
                        {/* Always show title and controls row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: isSelected ? 1 : 0.5 }}>
                          <Typography variant="h6" sx={{ flex: 1, fontSize: '0.95rem', fontWeight: 'bold' }}>
                            {event.title}
                          </Typography>
                          {isSelected && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Rating
                                value={event.importance}
                                readOnly
                                size="small"
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditEvent?.(event._id);
                                }}
                                sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>

                        {/* Always show date/time */}
                        <Typography variant="body2" color="primary" sx={{ mb: isSelected ? 1 : 0, fontSize: '0.8rem' }}>
                          {format(new Date(event.startDateTime), 'PPpp')}
                          {event.endDateTime && (
                            <span> - {format(new Date(event.endDateTime), 'PPpp')}</span>
                          )}
                        </Typography>

                        {/* Only show when selected: description and attachments */}
                        {isSelected && (
                          <>
                            {event.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>
                                {event.description}
                              </Typography>
                            )}

                            {/* Attachment thumbnails */}
                            {eventAttachments[event._id] && eventAttachments[event._id].length > 0 && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                {eventAttachments[event._id].slice(0, 3).map((attachment) => (
                                  <Box
                                    key={attachment._id}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: 0.5,
                                      overflow: 'hidden',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      cursor: 'pointer',
                                      '&:hover': { opacity: 0.8 },
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAttachmentClick(attachment);
                                    }}
                                  >
                                    {attachment.mimeType.startsWith('image/') ? (
                                      <Box
                                        component="img"
                                        src={attachment.url}
                                        alt={attachment.originalName}
                                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      <Box sx={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'grey.100',
                                        fontSize: '10px'
                                      }}>
                                        {attachment.mimeType.startsWith('video/') ? '🎥' :
                                         attachment.mimeType.startsWith('audio/') ? '🎵' : '📄'}
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                                {eventAttachments[event._id].length > 3 && (
                                  <Box sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'grey.200',
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                  }}>
                                    +{eventAttachments[event._id].length - 3}
                                  </Box>
                                )}
                              </Box>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          );
        })()}
      </Box>

      {/* Attachment Viewer Modal */}
      <AttachmentViewer
        open={viewerOpen}
        onClose={handleViewerClose}
        attachment={selectedAttachment}
      />
    </Box>
  );
}