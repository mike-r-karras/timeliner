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
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { Edit, ZoomIn, ZoomOut, Add, Link, Delete, Bolt, ExpandMore, ExpandLess } from '@mui/icons-material';
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

interface Link {
  _id: string;
  title: string;
  url: string;
}

interface TimelinePanelProps {
  timelineId?: string | null;
  selectedItems?: any;
  onSelection?: (type: 'event' | 'entity' | 'location', ids: string[], append?: boolean) => void;
  onEditEvent?: (eventId: string) => void;
  onAddEvent?: () => void;
  refreshTrigger?: number;
  onVisibleEventsChange?: (visibleEventIds: string[]) => void;
  mapReady?: boolean;
}

export default function TimelinePanel({ timelineId, selectedItems, onSelection, onEditEvent, onAddEvent, refreshTrigger, onVisibleEventsChange, mapReady }: TimelinePanelProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventAttachments, setEventAttachments] = useState<Record<string, Attachment[]>>({});
  const [eventLinks, setEventLinks] = useState<Record<string, Link[]>>({});
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());
  const [timelineTitle, setTimelineTitle] = useState('Untitled');

  // Client-only logging to prevent hydration mismatches
  const clientLog = (...args: any[]) => {
    if (typeof window !== 'undefined') {
      console.log(...args);
    }
  };
  const [zoomLevel, setZoomLevel] = useState(100);
  const [prevZoomLevel, setPrevZoomLevel] = useState(100);
  const [editingTitle, setEditingTitle] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ y: 0, scrollTop: 0 });
  const timelineScrollRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const expandRef = React.useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState(0);

  // URL parsing state
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [urlParsing, setUrlParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedDataDialog, setParsedDataDialog] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [parsedUrl, setParsedUrl] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [timeMarks, setTimeMarks] = useState<Array<{ position: number; date: Date; label: string; isMainMark: boolean }>>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate available height for timeline content - ONE TIME ONLY on mount
  useEffect(() => {
    if (!mapReady || !containerRef.current || !headerRef.current) return;

    const containerHeight = containerRef.current.clientHeight;
    const headerHeight = headerRef.current.clientHeight;
    const available = containerHeight - headerHeight;

    clientLog('Timeline viewport height measured (one-time):', {
      containerHeight,
      headerHeight,
      availableHeight: available
    });

    setAvailableHeight(available);

    // Window resize handler
    const handleResize = () => {
      if (containerRef.current && headerRef.current) {
        const newContainerHeight = containerRef.current.clientHeight;
        const newHeaderHeight = headerRef.current.clientHeight;
        const newAvailable = newContainerHeight - newHeaderHeight;

        clientLog('Window resize - updating viewport height:', {
          oldHeight: available,
          newHeight: newAvailable
        });

        setAvailableHeight(newAvailable);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [mapReady]);

  // Adjust available height when header expands/collapses (e.g. link expansion)
  useEffect(() => {
    if (!expandRef.current) return;
    console.log('********************************************\nEvent expand/collapse detected, recalculating available height...\n********************************************', expandRef.current.clientHeight);
  }, [expandRef.current?.clientHeight]);

  useEffect(() => {
    if (timelineId && isClient) {
      fetchTimelineData();
    }
  }, [timelineId, isClient, refreshTrigger]);

  // Generate time marks when events or zoom level change
  useEffect(() => {
    if (events.length > 0) {
      const timeRange = getTimeRange();
      setTimeMarks(generateTimeMarks(timeRange));
    }
  }, [events, zoomLevel]);

  // Track visible events using Intersection Observer
  useEffect(() => {
    if (!timelineScrollRef.current || !onVisibleEventsChange || events.length === 0) return;

    const visibleEventIds = new Set<string>();

    // Create intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        let hasChanges = false;

        entries.forEach((entry) => {
          const eventId = entry.target.getAttribute('data-event-id');
          if (!eventId) return;

          if (entry.isIntersecting) {
            if (!visibleEventIds.has(eventId)) {
              visibleEventIds.add(eventId);
              hasChanges = true;
            }
          } else {
            if (visibleEventIds.has(eventId)) {
              visibleEventIds.delete(eventId);
              hasChanges = true;
            }
          }
        });

        // Only notify if there were changes
        if (hasChanges) {
          onVisibleEventsChange(Array.from(visibleEventIds));
        }
      },
      {
        root: timelineScrollRef.current, // Use timeline container as root
        threshold: 0.1, // Trigger when 10% of the event card is visible
        rootMargin: '50px' // Add some margin for smoother updates
      }
    );

    // Observe all event cards
    const eventElements = timelineScrollRef.current.querySelectorAll('[data-event-id]');
    eventElements.forEach((element) => {
      observer.observe(element);
    });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [events, onVisibleEventsChange, zoomLevel, availableHeight]); // Re-run when events, zoom, or height changes

  // Maintain center focus when zoom level changes
  useEffect(() => {
    if (!timelineScrollRef.current || prevZoomLevel === zoomLevel || availableHeight === 0) return;

    const scrollContainer = timelineScrollRef.current;
    const containerHeight = scrollContainer.clientHeight;
    const scrollHeight = scrollContainer.scrollHeight;
    const currentScrollTop = scrollContainer.scrollTop;

    // Calculate current center position as percentage of timeline content
    const currentCenterPercentage = scrollHeight > 0 ?
      (currentScrollTop + containerHeight / 2) / scrollHeight : 0.5;

    // After zoom change, maintain similar relative position
    requestAnimationFrame(() => {
      if (timelineScrollRef.current) {
        const newScrollHeight = timelineScrollRef.current.scrollHeight;
        const newContainerHeight = timelineScrollRef.current.clientHeight;
        const targetScrollTop = (currentCenterPercentage * newScrollHeight) - newContainerHeight / 2;
        const maxScroll = newScrollHeight - newContainerHeight;

        timelineScrollRef.current.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));
      }
    });

    setPrevZoomLevel(zoomLevel);
  }, [zoomLevel, prevZoomLevel, availableHeight]);

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

        // Fetch attachments and links for each event
        const attachmentsMap: Record<string, Attachment[]> = {};
        const linksMap: Record<string, Link[]> = {};
        for (const event of sortedEvents) {
          try {
            const attachResponse = await fetch(`/api/attachments?eventId=${event._id}`);
            if (attachResponse.ok) {
              const attachments = await attachResponse.json();
              attachmentsMap[event._id] = attachments;
            }
          } catch (error) {
            clientLog(`Error fetching attachments for event ${event._id}:`, error);
          }

          try {
            const linksResponse = await fetch(`/api/links?eventId=${event._id}`);
            if (linksResponse.ok) {
              const links = await linksResponse.json();
              linksMap[event._id] = links;
            }
          } catch (error) {
            clientLog(`Error fetching links for event ${event._id}:`, error);
          }
        }
        setEventAttachments(attachmentsMap);
        setEventLinks(linksMap);
      }
    } catch (error) {
      clientLog('Error fetching timeline data:', error);
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
      clientLog('Error updating timeline title:', error);
    }
  };

  const handleEventClick = (eventId: string, shiftKey: boolean) => {
    // Don't trigger selection during drag
    if (isDragging) return;

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

  const toggleLinksExpanded = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // URL validation helper
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Handle URL parsing
  const handleParseUrl = async () => {
    if (!quickAddUrl.trim() || !isValidUrl(quickAddUrl) || !timelineId) return;

    setUrlParsing(true);
    setParseError(null);

    try {
      const response = await fetch('/api/parse-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: quickAddUrl.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setParsedData(data.parsed);
      setParsedUrl(data.url);
      setParsedDataDialog(true);
      setQuickAddUrl('');
    } catch (error) {
      clientLog('URL parsing error:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse URL');
    } finally {
      setUrlParsing(false);
    }
  };

  // Create items from parsed data
  const handleCreateFromParsedData = async () => {
    if (!parsedData || !timelineId) return;

    try {
      const createdItems = [];

      // Create events
      if (parsedData.events?.length > 0) {
        clientLog(`Creating ${parsedData.events.length} events:`, parsedData.events);
        for (let i = 0; i < parsedData.events.length; i++) {
          const eventData = parsedData.events[i];
          clientLog(`Creating event ${i + 1}/${parsedData.events.length}:`, eventData);
          try {
            const response = await fetch('/api/events', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...eventData,
                timelineId,
              }),
            });

            if (response.ok) {
              const event = await response.json();
              clientLog(`Event ${i + 1} created successfully:`, event.title);
              createdItems.push(`Event: ${event.title}`);

              // Create link with the parsed URL if available
              if (parsedUrl && event._id) {
                try {
                  const linkResponse = await fetch('/api/links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: event.title,
                      url: parsedUrl,
                      eventId: event._id,
                    }),
                  });

                  if (linkResponse.ok) {
                    clientLog(`Link created for event: ${event.title}`);
                  } else {
                    clientLog(`Failed to create link for event: ${event.title}`);
                  }
                } catch (linkError) {
                  clientLog(`Exception creating link for event ${event.title}:`, linkError);
                }
              }
            } else {
              const errorData = await response.json().catch(() => ({}));
              clientLog(`Failed to create event ${i + 1}:`, eventData, 'Error:', errorData);
              // Continue with the next event instead of stopping
            }
          } catch (eventError) {
            clientLog(`Exception creating event ${i + 1}:`, eventData, 'Exception:', eventError);
            // Continue with the next event instead of stopping
          }
        }
        clientLog(`Finished creating events. Successfully created: ${createdItems.filter(item => item.startsWith('Event:')).length}/${parsedData.events.length}`);
      }

      // Create entities
      if (parsedData.entities?.length > 0) {
        for (const entityData of parsedData.entities) {
          const response = await fetch('/api/entities', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...entityData,
              timelineId,
            }),
          });

          if (response.ok) {
            const entity = await response.json();
            createdItems.push(`Entity: ${entity.name}`);
          }
        }
      }

      // Create place entities from locations
      if (parsedData.locations?.length > 0) {
        for (const locationData of parsedData.locations) {
          const response = await fetch('/api/entities', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: locationData.name,
              type: 'place',
              description: locationData.description || locationData.address || '',
              importance: 3,
              timelineId,
            }),
          });

          if (response.ok) {
            const entity = await response.json();
            createdItems.push(`Place: ${entity.name}`);
          }
        }
      }

      if (createdItems.length > 0) {
        // Refresh timeline data
        fetchTimelineData();
        setParsedDataDialog(false);
        setParsedData(null);
        setParsedUrl(null);
      }
    } catch (error) {
      clientLog('Error creating items from parsed data:', error);
      setParseError('Failed to create items from parsed data');
    }
  };

  // Delete event handlers
  const handleDeleteEvent = (event: Event) => {
    setEventToDelete(event);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/events/${eventToDelete._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTimelineData(); // Refresh the timeline
        setDeleteConfirmOpen(false);
        setEventToDelete(null);
      } else {
        clientLog('Failed to delete event');
      }
    } catch (error) {
      clientLog('Error deleting event:', error);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteEvent = () => {
    setDeleteConfirmOpen(false);
    setEventToDelete(null);
  };

  // Drag scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!timelineScrollRef.current) return;

    setIsDragging(true);
    setDragStart({
      y: e.clientY,
      scrollTop: timelineScrollRef.current.scrollTop
    });

    // Prevent text selection
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !timelineScrollRef.current) return;

    const deltaY = e.clientY - dragStart.y;
    timelineScrollRef.current.scrollTop = dragStart.scrollTop - deltaY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
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

  // Alternative: Evenly distribute events regardless of their actual timestamps
  const getEventPositionEvenly = (eventIndex: number, totalEvents: number) => {
    if (totalEvents <= 1) return 50; // Center single event
    // Distribute events evenly with padding at top and bottom
    const usableSpace = 90; // Use 90% of space, leaving 5% padding top/bottom
    const startPadding = 5;
    const spacing = usableSpace / (totalEvents - 1);
    return startPadding + (eventIndex * spacing);
  };

  const generateTimeMarks = (timeRange: ReturnType<typeof getTimeRange>) => {
    const marks: Array<{ position: number; date: Date; label: string; isMainMark: boolean }> = [];
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
        date: new Date(currentTime),
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
          date: new Date(currentTime),
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
            date: new Date(currentTime),
            isMainMark: false
          });
        }
        currentTime += microInterval;
      }
    }

    // Sort by position and ensure we have marks covering the full timeline
    const sortedMarks = marks.sort((a, b) => a.position - b.position);

    // Add boundary marks at 0% and 100% if needed
    if (sortedMarks.length > 0) {
      const firstMark = sortedMarks[0];
      const lastMark = sortedMarks[sortedMarks.length - 1];

      // Add start mark if none exists at the beginning
      if (firstMark.position > 2) {
        sortedMarks.unshift({
          position: 0,
          label: formatMain(start),
          date: start,
          isMainMark: false
        });
      }

      // Add end mark if none exists at the end
      if (lastMark.position < 98) {
        sortedMarks.push({
          position: 100,
          label: formatMain(end),
          date: end,
          isMainMark: false
        });
      }
    }

    clientLog(`Generated ${sortedMarks.length} time marks for duration ${Math.round(duration / (1000 * 60))} minutes at zoom level ${zoomLevel}`, sortedMarks);

    // Return all marks (remove the artificial limit)
    return sortedMarks;
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Don't render timeline content until map is ready
  if (!mapReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden' // Prevent outer scroll, force inner scroll
      }}
      suppressHydrationWarning
    >
      {/* Timeline Header */}
      <Box ref={headerRef} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
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
            min={25}
            max={200}
            size="small"
            marks={[
              { value: 25, label: '25%' },
              { value: 50, label: '50%' },
              { value: 100, label: '100%' },
              { value: 200, label: '200%' }
            ]}
          />
          <ZoomIn fontSize="small" />
          <Typography variant="caption" sx={{ ml: 1 }}>
            Zoom: {zoomLevel}%
          </Typography>
        </Box>

        {/* Quick Add from URL */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <TextField
            size="small"
            placeholder="Quick add from URL"
            value={quickAddUrl}
            onChange={(e) => {
              setQuickAddUrl(e.target.value);
              setParseError(null);
            }}
            disabled={urlParsing}
            sx={{ flex: 1 }}
            error={!!parseError}
            helperText={parseError}
            InputProps={{
              startAdornment: <Link sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />,
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleParseUrl}
            disabled={!quickAddUrl.trim() || !isValidUrl(quickAddUrl) || urlParsing}
            startIcon={urlParsing ? <CircularProgress size={16} /> : undefined}
          >
            {urlParsing ? 'Parsing...' : 'Go'}
          </Button>
        </Box>

        {parseError && parseError.includes('Ollama') && (
          <Alert severity="info" sx={{ mt: 1, fontSize: '0.875rem' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Ollama LLM not available.</strong> To enable URL parsing:
            </Typography>
            <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              1. Install: <code>curl -fsSL https://ollama.ai/install.sh | sh</code><br/>
              2. Start: <code>ollama serve</code><br/>
              3. Pull model: <code>ollama pull llama3.2</code>
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Vertical Timeline */}
      <Box
        ref={timelineScrollRef}
        sx={{
          overflow: 'auto',
          overflowX: 'hidden', // Only allow vertical scroll
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: isDragging ? 'none' : 'auto',
          height: availableHeight > 0 ? `${availableHeight}px` : '100%', // Exact viewport height in pixels
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0,0,0,0.5)',
            },
          },
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
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

          // Timeline height calculation based on available viewport height and zoom level
          // Scroll container is set to exactly availableHeight pixels
          // At 100% zoom: timeline content = availableHeight (fills viewport, no scroll)
          // At 200% zoom: timeline content = 2x availableHeight (double height, scrolls)
          // At 50% zoom: timeline content = 0.5x availableHeight (compressed, no scroll)
          const fallbackHeight = Math.max(1000, events.length * 300); // Fallback if viewport not measured yet

          // Calculate additional height needed for expanded (selected) events
          // Collapsed event: ~40px, Expanded event: fit-content with minimum
          const collapsedEventHeight = 40;
          const expandedEventHeight = 80; // Minimum to fit title, date, rating - will grow with content
          const selectedEventCount = events.filter(e => isEventSelected(e._id)).length;
          const unselectedEventCount = events.length - selectedEventCount;

          // Total minimum height needed for all events stacked
          const minHeightForEvents = (selectedEventCount * expandedEventHeight) +
                                      (unselectedEventCount * collapsedEventHeight);

          const baseTimelineHeight = availableHeight > 0
            ? availableHeight * (zoomLevel / 100)
            : fallbackHeight;

          // Ensure timeline is tall enough to fit all events without overlap
          const finalTimelineHeight = Math.max(baseTimelineHeight, minHeightForEvents);

          clientLog('Timeline height calculation:', {
            availableHeight,
            zoomLevel,
            baseHeight: baseTimelineHeight,
            selectedEvents: selectedEventCount,
            minHeightForEvents,
            finalHeight: finalTimelineHeight,
            eventsCount: events.length,
            ratio: availableHeight > 0 ? (finalTimelineHeight / availableHeight).toFixed(2) + 'x viewport' : 'using fallback'
          });

          return (
            <Box sx={{
              position: 'relative',
              height: finalTimelineHeight,
              px: 2,
              py: 4, // Add vertical padding
              minHeight: finalTimelineHeight // Ensure minimum height
            }}>
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

              {/* Time marks and events with shared position calculations */}
              {(() => {
                // Calculate all event positions and bounds
                const eventData = events.map((event, index) => {
                  const startTemporalPosition = getEventPosition(event.startDateTime, timeRange);
                  const endDateTime = event.endDateTime || event.startDateTime;
                  const endTemporalPosition = getEventPosition(endDateTime, timeRange);

                  const centeringFactor = Math.max(0.1, zoomLevel / 100);
                  const startCenterOffset = (50 - startTemporalPosition) * (1 - centeringFactor);
                  const adjustedStartPosition = startTemporalPosition + startCenterOffset;
                  const eventStartPosition = Math.max(5, Math.min(95, adjustedStartPosition));

                  const endCenterOffset = (50 - endTemporalPosition) * (1 - centeringFactor);
                  const adjustedEndPosition = endTemporalPosition + endCenterOffset;
                  const eventEndPosition = Math.max(5, Math.min(95, adjustedEndPosition));

                  const isSelected = isEventSelected(event._id);
                  const temporalHeightPercent = Math.abs(eventEndPosition - eventStartPosition);
                  const temporalHeightPixels = (temporalHeightPercent / 100) * finalTimelineHeight;
                  const minHeight = isSelected ? expandedEventHeight : collapsedEventHeight;
                  const thisEventHeight = Math.max(minHeight, temporalHeightPixels);

                  // For bounds calculation, use a more generous estimate for selected events
                  // since they will expand to fit content
                  const estimatedHeight = isSelected ? Math.max(thisEventHeight, 150) : thisEventHeight;

                  return {
                    event,
                    index,
                    eventStartPosition,
                    eventEndPosition,
                    thisEventHeight,
                    estimatedHeight, // Used for bounds/overlap detection
                    topInPixels: (eventStartPosition / 100) * finalTimelineHeight,
                    isSelected,
                    pixelOffset: 0 // Will be calculated next
                  };
                });

                // Calculate pixel offsets for stacking
                const eventBounds: Array<{ top: number; bottom: number }> = [];
                eventData.forEach(data => {
                  let pixelOffset = 0;
                  for (const prevBound of eventBounds) {
                    const thisTop = data.topInPixels + pixelOffset;
                    if (thisTop < prevBound.bottom + 10) {
                      pixelOffset = prevBound.bottom + 10 - data.topInPixels;
                    }
                  }
                  data.pixelOffset = pixelOffset;
                  const finalTop = data.topInPixels + pixelOffset;
                  // Use estimatedHeight for bounds to account for fit-content expansion
                  const finalBottom = finalTop + data.estimatedHeight;
                  eventBounds.push({ top: finalTop, bottom: finalBottom });
                });

                // Render both time marks and events
                return (
                  <>
                    {/* Time marks filtered to not overlap with events */}
                    {timeMarks.map((mark, index) => {
                      const isMicroMark = mark.label === '·';
                      const markPositionPixels = (mark.position / 100) * finalTimelineHeight;

                      // Check if this mark falls within any event bounds (with small buffer for safety)
                      const buffer = 2; // 2px buffer to ensure marks at edges are also hidden
                      const overlapsEvent = eventBounds.some(bounds =>
                        markPositionPixels >= (bounds.top - buffer) && markPositionPixels <= (bounds.bottom + buffer)
                      );

                      // Skip rendering if mark overlaps with an event
                      if (overlapsEvent) {
                        return null;
                      }

                      return (
                        <Box key={`mark-${index}`}>
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
                    {eventData.map((data) => {
                      const { event, index, eventStartPosition, eventEndPosition, thisEventHeight, pixelOffset, isSelected } = data;

                  // Debug: Log event positioning
                  clientLog(`Event ${index + 1}: "${event.title}" positioned at ${eventStartPosition.toFixed(1)}%-${eventEndPosition.toFixed(1)}%`, {
                    startDateTime: event.startDateTime,
                    endDateTime: event.endDateTime || event.startDateTime,
                    startPosition: eventStartPosition,
                    endPosition: eventEndPosition,
                    duration: (event.endDateTime && event.endDateTime !== event.startDateTime) ? 'has duration' : 'instant',
                    finalHeight: thisEventHeight.toFixed(0) + 'px',
                    pixelOffset: pixelOffset,
                    zoomLevel: zoomLevel
                  });

                  return (
                    <Box
                      key={event._id}
                      sx={{
                        position: 'absolute',
                        top: `calc(${eventStartPosition}% + ${pixelOffset}px)`,
                        left: 8,
                        right: 8,
                        minHeight: thisEventHeight, // Minimum height for temporal duration
                        height: isSelected ? 'auto' : thisEventHeight, // Auto for selected, fixed for collapsed
                        zIndex: 3,
                        display: 'flex',
                        alignItems: 'stretch',
                      }}
                    >
                    {/* Event card */}
                    <Card
                      data-event-id={event._id}
                      sx={{
                        width: '100%',
                        height: isSelected ? 'auto' : '100%', // Auto height for selected events
                        minHeight: isSelected ? thisEventHeight : undefined, // Ensure temporal coverage
                        cursor: 'pointer',
                        border: isSelected ? '2px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        '&:hover': { elevation: 2 },
                        backgroundColor: isSelected ? 'primary.50' : 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onClick={(e) => handleEventClick(event._id, e.shiftKey)}
                    >
                      <CardContent sx={{
                        py: 1.5,
                        px: 2,
                        height: isSelected ? 'auto' : '100%', // Auto for selected, fill for collapsed
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: isSelected ? 'flex-start' : 'center',
                        overflow: isSelected ? 'visible' : 'hidden', // Allow content to show when expanded
                        transition: 'all 0.2s ease-in-out',
                        '&:last-child': {
                          pb: 1.5
                        }
                      }}>
                        {isSelected ? (
                          <>
                            {/* Expanded view: title and controls row */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, height: "fit-content" }}>
                              <Typography variant="h6" sx={{ flex: 1, fontSize: '0.95rem', fontWeight: 'bold' }} className="event-name">
                                {event.title}
                              </Typography>
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
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEvent(event);
                                  }}
                                  sx={{ opacity: 0.7, '&:hover': { opacity: 1, color: 'error.main' } }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>

                            {/* Expanded view: date/time */}
                            <Typography variant="body2" color="primary" sx={{ mb: 1, fontSize: '0.8rem' }}>
                              {format(new Date(event.startDateTime), 'PPpp')}
                              {event.endDateTime && (
                                <span> - {format(new Date(event.endDateTime), 'PPpp')}</span>
                              )}
                            </Typography>
                          </>
                        ) : (
                          /* Collapsed view: single line "Title - Date" */
                          <Typography
                            variant="body2"
                            className="event-name"
                            sx={{
                              fontSize: '0.9rem',
                              fontWeight: 'medium',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.2,
                              margin: 0,
                              padding: 0,
                            }}
                          >
                            {event.title} - <span style={{ color: '#1976d2', fontWeight: 'normal' }}>
                              {format(new Date(event.startDateTime), 'MMM d, yyyy h:mm a')}
                              {event.endDateTime && ` - ${format(new Date(event.endDateTime), 'h:mm a')}`}
                            </span>
                          </Typography>
                        )}

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
                                {eventAttachments[event._id].map((attachment) => (
                                  <Tooltip key={attachment._id} title={attachment.originalName} arrow>
                                    <Box
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
                                  </Tooltip>
                                ))}
                              </Box>
                            )}

                            {/* Links section */}
                            {eventLinks[event._id] && eventLinks[event._id].length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    '&:hover': { opacity: 0.7 },
                                  }}
                                  onClick={(e) => toggleLinksExpanded(event._id, e)}
                                >
                                  <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                                    Links
                                  </Typography>
                                  {expandedLinks.has(event._id) ? (
                                    <ExpandLess sx={{ fontSize: '0.9rem', ml: 0.5 }} />
                                  ) : (
                                    <ExpandMore sx={{ fontSize: '0.9rem', ml: 0.5 }} />
                                  )}
                                </Box>
                                {expandedLinks.has(event._id) && (
                                  <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                    {eventLinks[event._id].map((link) => (
                                      <Typography
                                        key={link._id}
                                        component="a"
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{
                                          fontSize: '0.7rem',
                                          color: 'primary.main',
                                          textDecoration: 'none',
                                          '&:hover': {
                                            textDecoration: 'underline',
                                          },
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {link.title}
                                      </Typography>
                                    ))}
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
                  </>
                );
              })()}
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

      {/* Parsed Data Dialog */}
      <Dialog
        open={parsedDataDialog}
        onClose={() => {
          setParsedDataDialog(false);
          setParsedData(null);
          setParsedUrl(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Parsed Data from URL
          <Typography variant="body2" color="text.secondary">
            Review and create timeline items from the parsed content
          </Typography>
        </DialogTitle>
        <DialogContent>
          {parsedData && (
            <Box sx={{ mt: 1 }}>
              {parsedData.events?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Events ({parsedData.events.length})
                  </Typography>
                  <List dense>
                    {parsedData.events.map((event: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={event.title}
                          secondary={
                            <Box component="div">
                              {event.description && (
                                <Box component="span" sx={{ display: 'block', mb: 0.5 }}>
                                  {event.description}
                                </Box>
                              )}
                              {event.startDateTime && (
                                <Box component="span" sx={{ display: 'block', color: 'primary.main', fontSize: '0.75rem' }}>
                                  {event.startDateTime}
                                  {event.endDateTime && ` - ${event.endDateTime}`}
                                </Box>
                              )}
                              {event.importance && (
                                <Chip
                                  label={`Importance: ${event.importance}/5`}
                                  size="small"
                                  sx={{ ml: 1, mt: 0.5 }}
                                />
                              )}
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {parsedData.entities?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Entities ({parsedData.entities.length})
                  </Typography>
                  <List dense>
                    {parsedData.entities.map((entity: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={entity.name}
                          secondary={
                            <Box component="div">
                              <Chip label={entity.type} size="small" sx={{ mr: 1, mb: 0.5 }} />
                              {entity.description && (
                                <Box component="span" sx={{ display: 'block' }}>
                                  {entity.description}
                                </Box>
                              )}
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {parsedData.locations?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Locations ({parsedData.locations.length})
                  </Typography>
                  <List dense>
                    {parsedData.locations.map((location: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={location.name}
                          secondary={
                            <Box component="div">
                              {location.address && (
                                <Box component="span" sx={{ display: 'block', mb: 0.5 }}>
                                  {location.address}
                                </Box>
                              )}
                              {location.description && (
                                <Box component="span" sx={{ display: 'block' }}>
                                  {location.description}
                                </Box>
                              )}
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {(!parsedData.events?.length && !parsedData.entities?.length && !parsedData.locations?.length) && (
                <Alert severity="info">
                  No structured data could be extracted from this URL. The LLM was unable to identify clear timeline events, entities, or locations in the content.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setParsedDataDialog(false);
              setParsedData(null);
              setParsedUrl(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFromParsedData}
            disabled={!parsedData || (!parsedData.events?.length && !parsedData.entities?.length && !parsedData.locations?.length)}
          >
            Create Items
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelDeleteEvent}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Confirm that you want to delete "{eventToDelete?.title}"
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={cancelDeleteEvent}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteEvent}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}