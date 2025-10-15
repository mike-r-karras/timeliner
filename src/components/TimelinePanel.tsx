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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import { Edit, ZoomIn, ZoomOut, Add, Link, Delete, Bolt, ExpandMore, ExpandLess, FilterList, CloudUpload } from '@mui/icons-material';
import { format } from 'date-fns';
import AttachmentViewer from './AttachmentViewer';
import ChainManagerModal from './ChainManagerModal';
import ParsingProgressModal from './ParsingProgressModal';

interface Event {
  _id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  importance: number;
  thumbnailUrl?: string;
  chainIds?: string[];
  locationId?: {
    _id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  footnotes?: Array<{
    number: number;
    type: 'link' | 'attachment';
    referenceId: string;
    pageRange?: string;
    customSource?: string;
  }>;
}

interface Chain {
  _id: string;
  name: string;
  color: string;
  description?: string;
  timelineId: string;
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
  onRefresh?: () => void;
  onVisibleEventsChange?: (visibleEventIds: string[]) => void;
  mapReady?: boolean;
}

export default function TimelinePanel({ timelineId, selectedItems, onSelection, onEditEvent, onAddEvent, refreshTrigger, onRefresh, onVisibleEventsChange, mapReady }: TimelinePanelProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [activeChainIds, setActiveChainIds] = useState<Set<string>>(new Set());
  const [chainFilterMode, setChainFilterMode] = useState<'any' | 'all'>('any');
  const [eventAttachments, setEventAttachments] = useState<Record<string, Attachment[]>>({});
  const [eventLinks, setEventLinks] = useState<Record<string, Link[]>>({});
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());
  const [timelineTitle, setTimelineTitle] = useState('Untitled');
  const [timelineTimezone, setTimelineTimezone] = useState('UTC');
  const [eventHeights, setEventHeights] = useState<Record<string, number>>({});
  const eventRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [chainManagerOpen, setChainManagerOpen] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState<Record<string, boolean>>({});
  const descriptionRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Client-only logging to prevent hydration mismatches
  const clientLog = (...args: any[]) => {
    if (typeof window !== 'undefined') {
      console.log(...args);
    }
  };
  const [zoomLevel, setZoomLevel] = useState(100);
  const [prevZoomLevel, setPrevZoomLevel] = useState(100);
  const [scaleMarks, setScaleMarks] = useState(10);
  const [editingTitle, setEditingTitle] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
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

  // File parsing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileParsing, setFileParsing] = useState(false);
  const [parsingElapsed, setParsingElapsed] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const parsingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Parsing progress modal state
  const [showParsingProgress, setShowParsingProgress] = useState(false);
  const [estimatedTokenCount, setEstimatedTokenCount] = useState(1000);
  const [currentParsingType, setCurrentParsingType] = useState<'url' | 'file'>('file');
  const [currentFileName, setCurrentFileName] = useState<string | undefined>();

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Event detail modal state
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<Event | null>(null);
  const [timeMarks, setTimeMarks] = useState<Array<{ position: number; date: Date; label: string; isMainMark: boolean }>>([]);
  const [scrollRestored, setScrollRestored] = useState(false);
  const [heightReady, setHeightReady] = useState(false);
  const [zoomRestored, setZoomRestored] = useState(false);
  const [creatingParsedEvent, setCreatingParsedEvent] = useState(false);
  const scrollSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate available height for timeline content - recalculates on mount, resize, and tab changes
  useEffect(() => {
    if (!mapReady || !containerRef.current || !headerRef.current) return;

    // Small delay to ensure DOM has updated after tab change
    const timer = setTimeout(() => {
      if (!containerRef.current || !headerRef.current) return;

      const containerHeight = containerRef.current.clientHeight;
      const headerHeight = headerRef.current.clientHeight;
      const available = containerHeight - headerHeight;

      clientLog('Timeline viewport height measured:', {
        containerHeight,
        headerHeight,
        availableHeight: available
      });

      setAvailableHeight(available);
      setHeightReady(available > 0);
    }, 0);

    // Window resize handler
    const handleResize = () => {
      if (containerRef.current && headerRef.current) {
        const newContainerHeight = containerRef.current.clientHeight;
        const newHeaderHeight = headerRef.current.clientHeight;
        const newAvailable = newContainerHeight - newHeaderHeight;

        clientLog('Window resize - updating viewport height:', {
          oldHeight: availableHeight,
          newHeight: newAvailable
        });

        setAvailableHeight(newAvailable);
        setHeightReady(newAvailable > 0);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [mapReady, activeTab]);

  // Adjust available height when header expands/collapses (e.g. link expansion)
  useEffect(() => {
    if (!expandRef.current) return;
    console.log('********************************************\nEvent expand/collapse detected, recalculating available height...\n********************************************', expandRef.current.clientHeight);
  }, [expandRef.current?.clientHeight]);

  useEffect(() => {
    if (timelineId && isClient) {
      fetchTimelineData();
      fetchChains();
    }
  }, [timelineId, isClient, refreshTrigger]);

  // Load active chains from localStorage
  useEffect(() => {
    if (timelineId && isClient) {
      const savedActiveChains = localStorage.getItem(`timeliner:activeChains:${timelineId}`);
      if (savedActiveChains) {
        try {
          const chainIds = JSON.parse(savedActiveChains);
          setActiveChainIds(new Set(chainIds));
        } catch (error) {
          clientLog('Error parsing saved active chains:', error);
        }
      }
    }
  }, [timelineId, isClient]);

  // Save active chains to localStorage
  useEffect(() => {
    if (timelineId && isClient) {
      localStorage.setItem(`timeliner:activeChains:${timelineId}`, JSON.stringify(Array.from(activeChainIds)));
    }
  }, [activeChainIds, timelineId, isClient]);

  // Restore zoom level when timeline loads
  useEffect(() => {
    if (timelineId && isClient) {
      const savedZoomLevel = localStorage.getItem(`timeliner:zoom:${timelineId}`);
      if (savedZoomLevel) {
        const zoom = parseInt(savedZoomLevel, 10);
        setZoomLevel(zoom);
        setPrevZoomLevel(zoom);
      }
      // Mark zoom as restored after a brief delay to allow state to settle
      setTimeout(() => setZoomRestored(true), 50);
    }
  }, [timelineId, isClient]);

  // Save zoom level when it changes
  useEffect(() => {
    if (timelineId && isClient) {
      localStorage.setItem(`timeliner:zoom:${timelineId}`, zoomLevel.toString());
    }
  }, [zoomLevel, timelineId, isClient]);

  // Reset scroll and zoom restoration flags when timeline changes
  useEffect(() => {
    setScrollRestored(false);
    setZoomRestored(false);
  }, [timelineId]);

  // Restore scroll position after timeline data loads and trigger initial visibility check
  useEffect(() => {
    // Wait for timeline height to be calculated and zoom to be restored before restoring scroll
    if (!timelineScrollRef.current || !timelineId || scrollRestored || events.length === 0 || !isClient || !heightReady || !zoomRestored) return;

    const manualVisibilityCheck = () => {
      if (timelineScrollRef.current && onVisibleEventsChange) {
        // Manually check which events are visible
        const scrollContainer = timelineScrollRef.current;
        const containerRect = scrollContainer.getBoundingClientRect();
        const eventElements = scrollContainer.querySelectorAll('[data-event-id]');
        const visible: string[] = [];

        eventElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const eventId = element.getAttribute('data-event-id');

          // Check if element is in viewport
          if (eventId && rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
            visible.push(eventId);
          }
        });

        if (visible.length > 0) {
          onVisibleEventsChange(visible);
        }
      }
    };

    const savedScrollPosition = localStorage.getItem(`timeliner:scroll:${timelineId}`);
    if (savedScrollPosition) {
      // Wait longer to ensure zoom is applied and timeline content is fully rendered at final height
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (timelineScrollRef.current) {
            const scrollTop = parseInt(savedScrollPosition, 10);
            timelineScrollRef.current.scrollTop = scrollTop;
            setScrollRestored(true);

            // Force visibility check after scroll restoration
            requestAnimationFrame(manualVisibilityCheck);
          }
        });
      }, 300); // Longer delay to ensure zoom and DOM are fully rendered
    } else {
      // No saved scroll position, but still need to trigger initial visibility check
      setScrollRestored(true);
      requestAnimationFrame(manualVisibilityCheck);
    }
  }, [timelineId, events, scrollRestored, isClient, heightReady, zoomRestored, onVisibleEventsChange]);

  // Save scroll position when scrolling (throttled)
  useEffect(() => {
    if (!timelineScrollRef.current || !timelineId) return;

    const handleScroll = () => {
      if (!timelineScrollRef.current || !timelineId) return;

      const scrollTop = timelineScrollRef.current.scrollTop;

      // Throttle saves to localStorage
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }

      scrollSaveTimeoutRef.current = setTimeout(() => {
        localStorage.setItem(`timeliner:scroll:${timelineId}`, scrollTop.toString());
      }, 500); // Save after 500ms of no scrolling
    };

    const scrollElement = timelineScrollRef.current;
    scrollElement.addEventListener('scroll', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }
    };
  }, [timelineId]);

  // Generate time marks when events, zoom level, or timezone change
  useEffect(() => {
    if (events.length > 0) {
      const timeRange = getTimeRange();
      setTimeMarks(generateTimeMarks(timeRange));
    }
  }, [events, zoomLevel, timelineTimezone]);

  // Track event card heights using ResizeObserver
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const newHeights: Record<string, number> = {};
      entries.forEach((entry) => {
        const eventId = entry.target.getAttribute('data-event-id');
        if (eventId) {
          newHeights[eventId] = entry.contentRect.height;
        }
      });

      setEventHeights(prev => ({
        ...prev,
        ...newHeights
      }));
    });

    Object.values(eventRefs.current).forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [events, selectedItems]);

  // Check if description text overflows (more than 3 lines)
  useEffect(() => {
    const overflows: Record<string, boolean> = {};

    Object.entries(descriptionRefs.current).forEach(([eventId, ref]) => {
      if (ref) {
        // scrollHeight > clientHeight means content is truncated
        overflows[eventId] = ref.scrollHeight > ref.clientHeight;
      }
    });

    setDescriptionOverflows(overflows);
  }, [events, selectedItems, zoomLevel]);

  // Track visible events using Intersection Observer
  useEffect(() => {
    if (!timelineScrollRef.current || !onVisibleEventsChange || events.length === 0) return;

    // Use a ref to persist visible event IDs across observer callbacks
    const visibleEventIdsRef = { current: new Set<string>() };

    // Create intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        let hasChanges = false;

        entries.forEach((entry) => {
          const eventId = entry.target.getAttribute('data-event-id');
          if (!eventId) return;

          if (entry.isIntersecting) {
            if (!visibleEventIdsRef.current.has(eventId)) {
              visibleEventIdsRef.current.add(eventId);
              hasChanges = true;
            }
          } else {
            if (visibleEventIdsRef.current.has(eventId)) {
              visibleEventIdsRef.current.delete(eventId);
              hasChanges = true;
            }
          }
        });

        // Only notify if there were changes
        if (hasChanges) {
          onVisibleEventsChange(Array.from(visibleEventIdsRef.current));
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
  }, [events, onVisibleEventsChange]); // Only re-run when events or callback changes

  // Maintain center focus when zoom level changes (but not during initial restoration)
  useEffect(() => {
    // Skip if scroll hasn't been restored yet (initial load)
    if (!timelineScrollRef.current || prevZoomLevel === zoomLevel || availableHeight === 0 || !scrollRestored) return;

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
  }, [zoomLevel, prevZoomLevel, availableHeight, scrollRestored]);

  const fetchChains = async () => {
    if (!timelineId) return;

    try {
      const response = await fetch(`/api/chains?timelineId=${timelineId}`);
      if (response.ok) {
        const data = await response.json();
        clientLog('Fetched chains:', data);
        setChains(data);
      } else {
        clientLog('Failed to fetch chains:', response.status);
      }
    } catch (error) {
      clientLog('Error fetching chains:', error);
    }
  };

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
        setTimelineTimezone(timeline.timezone || 'UTC');
      }

      if (eventsResponse.ok) {
        const eventData = await eventsResponse.json();
        const sortedEvents = eventData.sort((a: Event, b: Event) =>
          new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        );
        clientLog('Fetched events with chainIds:', sortedEvents.map((e: Event) => ({ title: e.title, chainIds: e.chainIds })));
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

  const handleTimezoneUpdate = async (newTimezone: string) => {
    try {
      const response = await fetch(`/api/timelines/${timelineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: newTimezone }),
      });

      if (response.ok) {
        setTimelineTimezone(newTimezone);
      }
    } catch (error) {
      clientLog('Error updating timeline timezone:', error);
    }
  };

  // Helper function to format dates in the selected timezone
  const formatDateInTimezone = (dateString: string, formatStr: string): string => {
    const date = new Date(dateString);

    // Use Intl.DateTimeFormat for timezone conversion
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timelineTimezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    };

    // For different format strings, adjust options
    if (formatStr === 'PPpp') {
      // Full date and time
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } else if (formatStr === 'MMM d, yyyy h:mm a') {
      // Short format
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } else if (formatStr === 'h:mm a') {
      // Time only
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: timelineTimezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      };
      return new Intl.DateTimeFormat('en-US', timeOptions).format(date);
    }

    // Default: use date-fns format but with timezone-converted date
    return format(date, formatStr);
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

  const renderDescriptionWithFootnotes = (
    description: string,
    event: Event
  ): React.ReactNode => {
    if (!event.footnotes || event.footnotes.length === 0) {
      return description;
    }

    // Parse description for [N] patterns
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\[(\d+)\]/g;
    let match;

    while ((match = regex.exec(description)) !== null) {
      const footnoteNumber = parseInt(match[1], 10);
      const footnote = event.footnotes.find(f => f.number === footnoteNumber);

      // Add text before the footnote
      if (match.index > lastIndex) {
        parts.push(description.substring(lastIndex, match.index));
      }

      if (footnote) {
        // Convert IDs to strings for comparison
        const referenceId = String(footnote.referenceId);
        const reference = footnote.type === 'link'
          ? eventLinks[event._id]?.find(l => String(l._id) === referenceId)
          : eventAttachments[event._id]?.find(a => String(a._id) === referenceId);

        if (reference) {
          const sourceText = footnote.customSource || (
            footnote.type === 'attachment'
              ? (reference as Attachment).type
              : 'link'
          );

          // Use footnote.date if provided, otherwise fall back to attachment date
          const dateText = footnote.date || (
            footnote.type === 'attachment' && (reference as Attachment).date
              ? new Date((reference as Attachment).date!).toLocaleDateString()
              : ''
          );

          const pageRangeText = footnote.pageRange || '';
          const detailParts = [sourceText, dateText, pageRangeText].filter(Boolean);
          const displayText = detailParts.join(', ');

          parts.push(
            <Chip
              key={`footnote-${event._id}-${footnoteNumber}-${match.index}`}
              label={`[${displayText}]`}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (footnote.type === 'link') {
                  const link = reference as Link;
                  window.open(link.url, '_blank', 'noopener,noreferrer');
                } else {
                  handleAttachmentClick(reference as Attachment);
                }
              }}
              sx={{
                cursor: 'pointer',
                fontSize: '0.65rem',
                height: 'auto',
                mx: 0.25,
                verticalAlign: 'middle',
                '&:hover': {
                  backgroundColor: 'primary.light',
                },
              }}
            />
          );
        } else {
          // Footnote reference not found - show placeholder with source info if available
          const fallbackText = footnote.customSource || (footnote.type === 'attachment' ? 'attachment' : 'link');
          const fallbackParts = [fallbackText, footnote.date, footnote.pageRange].filter(Boolean);
          const fallbackDisplay = fallbackParts.length > 0 ? fallbackParts.join(', ') : String(footnoteNumber);

          parts.push(
            <Chip
              key={`footnote-${event._id}-${footnoteNumber}-${match.index}`}
              label={`[${fallbackDisplay}]`}
              size="small"
              sx={{
                fontSize: '0.65rem',
                height: 'auto',
                mx: 0.25,
                verticalAlign: 'middle',
                backgroundColor: 'warning.light',
              }}
            />
          );
        }
      } else {
        // Footnote not defined, keep the original text
        parts.push(match[0]);
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after last footnote
    if (lastIndex < description.length) {
      parts.push(description.substring(lastIndex));
    }

    return <>{parts}</>;
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

  const toggleChainFilter = (chainId: string) => {
    setActiveChainIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chainId)) {
        newSet.delete(chainId);
      } else {
        newSet.add(chainId);
      }
      return newSet;
    });
  };

  const clearAllChainFilters = () => {
    setActiveChainIds(new Set());
  };

  const selectAllChainFilters = () => {
    setActiveChainIds(new Set(chains.map(c => c._id)));
  };

  const getVisibleEvents = () => {
    // If no chains selected, show all events
    if (activeChainIds.size === 0) return events;

    return events.filter(event => {
      // Events with no chains always show when no filter is active
      if (!event.chainIds || event.chainIds.length === 0) return false;

      if (chainFilterMode === 'any') {
        // Show if event belongs to ANY active chain
        return event.chainIds.some(id => activeChainIds.has(id));
      } else {
        // Show if event belongs to ALL active chains
        return Array.from(activeChainIds).every(id => event.chainIds?.includes(id));
      }
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
    setParsingElapsed(0);

    // Show parsing progress modal with estimated token count
    // Estimate ~500 tokens per URL (will be updated by API)
    setEstimatedTokenCount(500);
    setCurrentParsingType('url');
    setCurrentFileName(undefined);
    setShowParsingProgress(true);

    // Start timer
    const startTime = Date.now();
    parsingTimerRef.current = setInterval(() => {
      setParsingElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

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
      // Stop timer
      if (parsingTimerRef.current) {
        clearInterval(parsingTimerRef.current);
        parsingTimerRef.current = null;
      }
      setShowParsingProgress(false);
      setUrlParsing(false);
    }
  };

  // Handle file parsing
  const handleParseFile = async () => {
    if (!selectedFile || !timelineId) return;

    setFileParsing(true);
    setParseError(null);
    setParsingElapsed(0);

    // Show parsing progress modal with estimated token count
    // Estimate ~4 characters per token, average file size gives rough token count
    const estimatedTokens = Math.floor(selectedFile.size / 4);
    setEstimatedTokenCount(estimatedTokens);
    setCurrentParsingType('file');
    setCurrentFileName(selectedFile.name);
    setShowParsingProgress(true);

    // Start timer
    const startTime = Date.now();
    parsingTimerRef.current = setInterval(() => {
      setParsingElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/parse-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setParsedData(data.parsed);
      setParsedUrl(data.fileName);
      setParsedDataDialog(true);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      clientLog('File parsing error:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      // Stop timer
      if (parsingTimerRef.current) {
        clearInterval(parsingTimerRef.current);
        parsingTimerRef.current = null;
      }
      setShowParsingProgress(false);
      setFileParsing(false);
    }
  };

  // Handle Go button - parse URL or file
  const handleParse = async () => {
    if (selectedFile) {
      await handleParseFile();
    } else if (quickAddUrl.trim() && isValidUrl(quickAddUrl)) {
      await handleParseUrl();
    }
  };

  // Create items from parsed data
  const handleCreateFromParsedData = async () => {
    if (!parsedData || !timelineId) return;
    setCreatingParsedEvent(true);
    try {
      const createdItems: string[] = [];
      const chainMap = new Map<string, string>(); // name -> id
      const entityMap = new Map<string, string>(); // name -> id
      const eventMap = new Map<string, string>(); // title -> id
      const attachmentMap = new Map<string, string>(); // originalName -> id
      const linkMap = new Map<string, string>(); // title -> id

      // Step 0: Fetch existing entities and connections to check for duplicates
      let existingEntities: any[] = [];
      let existingConnections: any[] = [];

      try {
        const entitiesResponse = await fetch(`/api/entities?timelineId=${timelineId}`);
        if (entitiesResponse.ok) {
          existingEntities = await entitiesResponse.json();
          clientLog(`Found ${existingEntities.length} existing entities`);
        }

        const connectionsResponse = await fetch(`/api/connections?timelineId=${timelineId}`);
        if (connectionsResponse.ok) {
          existingConnections = await connectionsResponse.json();
          clientLog(`Found ${existingConnections.length} existing connections`);
        }
      } catch (error) {
        clientLog('Error fetching existing data:', error);
      }

      // Step 1: Create chains (check for duplicates first)
      if (parsedData.chains?.length > 0) {
        clientLog(`Processing ${parsedData.chains.length} chains:`, parsedData.chains);
        for (const chainData of parsedData.chains) {
          try {
            // Check if chain already exists (same name in same timeline)
            const existingChain = chains.find((c: any) => c.name === chainData.name);

            if (existingChain) {
              chainMap.set(chainData.name, existingChain._id);
              clientLog(`Chain already exists, using existing: ${existingChain.name} (${existingChain._id})`);
              createdItems.push(`Chain (existing): ${existingChain.name}`);
            } else {
              // Generate a hex color for the chain (use a consistent hash-based color)
              const generateColor = (name: string) => {
                let hash = 0;
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                // Generate RGB values from hash
                const r = (hash & 0xFF0000) >> 16;
                const g = (hash & 0x00FF00) >> 8;
                const b = hash & 0x0000FF;
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              };

              const response = await fetch('/api/chains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: chainData.name,
                  description: chainData.description,
                  color: generateColor(chainData.name), // Required field
                  timelineId,
                }),
              });

              if (response.ok) {
                const chain = await response.json();
                chainMap.set(chainData.name, chain._id);
                createdItems.push(`Chain (new): ${chain.name}`);
                clientLog(`Chain created: ${chain.name}`);
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Failed to create chain:`, {
                  chainData,
                  error: errorData,
                  status: response.status
                });
              }
            }
          } catch (error) {
            clientLog(`Failed to create chain ${chainData.name}:`, error);
          }
        }
      }

      // Step 2: Create Location records and place entities from locations BEFORE events
      const locationMap = new Map<string, string>(); // location name -> Location record ID
      const placeEntityMap = new Map<string, string>(); // location name -> place Entity ID
      if (parsedData.locations?.length > 0) {
        clientLog(`Processing ${parsedData.locations.length} locations:`, parsedData.locations);
        for (const locationData of parsedData.locations) {
          // First, create or find the Location record with coordinates
          let locationRecordId: string | undefined;

          // Check if Location already exists
          const existingLocationResponse = await fetch(`/api/locations?search=${encodeURIComponent(locationData.name)}`);
          if (existingLocationResponse.ok) {
            const existingLocations = await existingLocationResponse.json();
            const exactMatch = existingLocations.find((loc: any) =>
              loc.name === locationData.name &&
              loc.latitude === locationData.lat &&
              loc.longitude === locationData.lon
            );
            if (exactMatch) {
              locationRecordId = exactMatch._id;
              clientLog(`Location record already exists: ${exactMatch.name} (${exactMatch._id})`);
            }
          }

          // Create Location record if it doesn't exist
          if (!locationRecordId && locationData.lat && locationData.lon) {
            const locationResponse = await fetch('/api/locations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: locationData.name,
                latitude: locationData.lat,
                longitude: locationData.lon,
                description: locationData.description || '',
                geocoded: true,
                geocodingSource: 'nominatim',
              }),
            });

            if (locationResponse.ok) {
              const location = await locationResponse.json();
              locationRecordId = location._id;
              clientLog(`Location record created: ${location.name} (${location._id}) at [${location.latitude}, ${location.longitude}]`);
              createdItems.push(`Location: ${location.name}`);
            } else {
              const errorData = await locationResponse.json().catch(() => ({}));
              console.error('Failed to create Location record:', errorData);
            }
          }

          locationMap.set(locationData.name, locationRecordId || '');

          // Now create or find the place Entity with locationId
          const existingEntity = existingEntities.find(
            (e: any) => e.name === locationData.name && e.type === 'place'
          );

          if (existingEntity) {
            placeEntityMap.set(locationData.name, existingEntity._id);
            entityMap.set(locationData.name, existingEntity._id);
            clientLog(`Place entity already exists: ${existingEntity.name}`);
            createdItems.push(`Place (existing): ${existingEntity.name}`);
          } else {
            const entityResponse = await fetch('/api/entities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: locationData.name,
                type: 'place',
                description: locationData.description || '',
                importance: 3,
                locationId: locationRecordId,
                timelineId,
              }),
            });

            if (entityResponse.ok) {
              const entity = await entityResponse.json();
              placeEntityMap.set(locationData.name, entity._id);
              entityMap.set(locationData.name, entity._id);
              existingEntities.push(entity);
              createdItems.push(`Place (new): ${entity.name}`);
              clientLog(`Place entity created: ${entity.name} (${entity._id}) with locationId: ${locationRecordId}`);
            }
          }
        }
      }

      // Step 3: Create events (with chain and location assignments)
      if (parsedData.events?.length > 0) {
        clientLog(`Creating ${parsedData.events.length} events:`, parsedData.events);
        for (let i = 0; i < parsedData.events.length; i++) {
          const eventData = parsedData.events[i];
          clientLog(`Creating event ${i + 1}/${parsedData.events.length}:`, eventData);
          clientLog(`Event description length: ${eventData.description?.length || 0} chars`);
          clientLog(`Event chains: ${eventData.chains?.join(', ') || 'none'}`);
          if (eventData.location) {
            clientLog(`Event location: ${eventData.location} (ID: ${locationMap.get(eventData.location) || 'not found'})`);
          }
          try {
            // Map chain names to IDs
            const chainIds = eventData.chains
              ?.map((chainName: string) => chainMap.get(chainName))
              .filter((id: string | undefined): id is string => !!id) || [];

            // Map location name to Location record ID if it exists
            const locationId = eventData.location ? locationMap.get(eventData.location) : undefined;

            const response = await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: eventData.title,
                description: eventData.description,
                startDateTime: eventData.startDateTime,
                endDateTime: eventData.endDateTime,
                importance: eventData.importance,
                locationId: locationId, // Use locationId instead of location string
                chainIds: chainIds,
                timelineId,
              }),
            });

            if (response.ok) {
              const event = await response.json();
              eventMap.set(eventData.title, event._id);
              clientLog(`Event ${i + 1} created successfully:`, event.title);
              createdItems.push(`Event: ${event.title}`);

              // Create link with the parsed URL if available (for URL parsing only, not file parsing)
              if (parsedUrl && event._id && parsedUrl.startsWith('http')) {
                try {
                  const linkResponse = await fetch('/api/links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: `Source: ${event.title}`,
                      url: parsedUrl,
                      eventId: event._id,
                    }),
                  });

                  if (linkResponse.ok) {
                    clientLog(`Link created for event: ${event.title}`);
                  }
                } catch (linkError) {
                  clientLog(`Exception creating link for event ${event.title}:`, linkError);
                }
              }
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error(`Failed to create event ${i + 1}:`, {
                eventData,
                error: errorData,
                status: response.status
              });
              clientLog(`Failed to create event ${i + 1}:`, eventData, 'Error:', errorData);
            }
          } catch (eventError) {
            clientLog(`Exception creating event ${i + 1}:`, eventData, 'Exception:', eventError);
          }
        }
        clientLog(`Finished creating events. Successfully created: ${createdItems.filter(item => item.startsWith('Event:')).length}/${parsedData.events.length}`);
      }

      // Step 4: Create entities (check for duplicates first)
      if (parsedData.entities?.length > 0) {
        clientLog(`Processing ${parsedData.entities.length} entities:`, parsedData.entities);
        for (const entityData of parsedData.entities) {
          try {
            // Check if entity already exists (same name + type combination)
            const existingEntity = existingEntities.find(
              (e: any) => e.name === entityData.name && e.type === entityData.type
            );

            if (existingEntity) {
              entityMap.set(entityData.name, existingEntity._id);
              clientLog(`Entity already exists, using existing: ${existingEntity.name} (${existingEntity._id})`);
              createdItems.push(`Entity (existing): ${existingEntity.name}`);
            } else {
              // Create new entity
              const response = await fetch('/api/entities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: entityData.name,
                  type: entityData.type,
                  description: entityData.description,
                  importance: entityData.importance,
                  metadata: entityData.metadata,
                  timelineId,
                }),
              });

              if (response.ok) {
                const entity = await response.json();
                entityMap.set(entityData.name, entity._id);
                existingEntities.push(entity); // Add to existing entities to prevent duplicates in this batch
                createdItems.push(`Entity (new): ${entity.name}`);
                clientLog(`Entity created: ${entity.name} (${entity._id})`);
              }
            }
          } catch (error) {
            clientLog(`Failed to process entity ${entityData.name}:`, error);
          }
        }
      }

      // Step 5: Create attachments (associate with first event)
      if (parsedData.attachments?.length > 0) {
        clientLog(`Creating ${parsedData.attachments.length} attachments:`, parsedData.attachments);

        // Get first event ID to associate attachments with
        const firstEventTitle = parsedData.events?.[0]?.title;
        const firstEventId = firstEventTitle ? eventMap.get(firstEventTitle) : null;

        if (!firstEventId) {
          clientLog('No event found to associate attachments with, skipping attachment creation');
        } else {
          for (const attachmentData of parsedData.attachments) {
            try {
              const response = await fetch('/api/attachments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: attachmentData.url,
                  originalName: attachmentData.originalName,
                  type: attachmentData.type,
                  metadata: attachmentData.metadata,
                  eventId: firstEventId,
                }),
              });

              if (response.ok) {
                const result = await response.json();

                // Check if attachment was skipped due to download failure
                if (result.skipped) {
                  clientLog(`⚠️ Attachment skipped (${result.reason}): ${attachmentData.originalName}`);
                  createdItems.push(`Attachment (skipped): ${attachmentData.originalName}`);
                } else {
                  // Successfully created attachment
                  attachmentMap.set(attachmentData.originalName, result._id);
                  createdItems.push(`Attachment: ${result.originalName}`);
                  clientLog(`Attachment created: ${result.originalName}`);
                }
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Failed to create attachment (${response.status}):`, {
                  attachmentData,
                  error: errorData,
                  status: response.status,
                  url: attachmentData.url,
                });
                clientLog(`Attachment creation failed: ${errorData.error || 'Unknown error'} - URL: ${attachmentData.url}`);
              }
            } catch (error) {
              clientLog(`Failed to create attachment ${attachmentData.originalName}:`, error);
            }
          }
        }
      }

      // Step 6: Create links (standalone links without event/entity association yet)
      if (parsedData.links?.length > 0) {
        clientLog(`Creating ${parsedData.links.length} links:`, parsedData.links);
        for (const linkData of parsedData.links) {
          try {
            // Links need to be associated with an event or entity
            // For now, associate with the first event if available
            const firstEventTitle = parsedData.events?.[0]?.title;
            const firstEventId = firstEventTitle ? eventMap.get(firstEventTitle) : null;

            if (!firstEventId) {
              clientLog(`Skipping link ${linkData.title} - no event to associate with`);
              continue;
            }

            // Clean up link title - remove "[N]:" prefix if present
            const cleanTitle = linkData.title.replace(/^\[\d+\]:\s*/, '');

            const response = await fetch('/api/links', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: cleanTitle,
                url: linkData.url,
                eventId: firstEventId, // Links require eventId or entityId
              }),
            });

            if (response.ok) {
              const responseData = await response.json();
              const link = responseData.link; // API returns { message, link }
              linkMap.set(cleanTitle, link._id);
              createdItems.push(`Link: ${link.title}`);
              clientLog(`Link created: ${link.title}`);
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error(`Failed to create link:`, {
                linkData,
                error: errorData,
                status: response.status
              });
            }
          } catch (error) {
            clientLog(`Failed to create link ${linkData.title}:`, error);
          }
        }
      }

      // Step 7: Add footnotes to events
      if (parsedData.footnotes?.length > 0 && parsedData.events?.length > 0) {
        clientLog(`Adding ${parsedData.footnotes.length} footnotes to events`);
        clientLog(`linkMap has ${linkMap.size} entries:`, Array.from(linkMap.keys()));
        clientLog(`attachmentMap has ${attachmentMap.size} entries:`, Array.from(attachmentMap.keys()));

        // Assume footnotes belong to the first event (or extend this logic)
        const firstEventTitle = parsedData.events[0].title;
        const firstEventId = eventMap.get(firstEventTitle);

        if (firstEventId) {
          try {
            // Map footnotes to reference IDs
            const mappedFootnotes = parsedData.footnotes.map((fn: any) => {
              // Clean up reference name - remove "[N]:" prefix if present
              const cleanReferenceName = fn.referenceName.replace(/^\[\d+\]:\s*/, '');

              const referenceId = fn.type === 'link'
                ? linkMap.get(cleanReferenceName)
                : attachmentMap.get(cleanReferenceName);

              clientLog(`Mapping footnote [${fn.number}] "${fn.referenceName}" → "${cleanReferenceName}" (${fn.type}): ${referenceId ? 'FOUND' : 'NOT FOUND'}`);

              return {
                number: fn.number,
                type: fn.type,
                referenceId,
                pageRange: fn.pageRange,
                customSource: fn.customSource,
                date: fn.date,
              };
            }).filter((fn: any) => fn.referenceId); // Only keep valid references

            clientLog(`Mapped ${mappedFootnotes.length} footnotes (filtered from ${parsedData.footnotes.length})`);

            if (mappedFootnotes.length > 0) {
              const response = await fetch(`/api/events/${firstEventId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  footnotes: mappedFootnotes,
                }),
              });

              if (response.ok) {
                clientLog(`Footnotes added to event: ${firstEventTitle}`);
              }
            }
          } catch (error) {
            clientLog(`Failed to add footnotes to event:`, error);
          }
        }
      }

      // Step 8: Create connections (entity relationships - check for duplicates)
      if (parsedData.connections?.length > 0) {
        clientLog(`Processing ${parsedData.connections.length} connections:`, parsedData.connections);
        for (const connectionData of parsedData.connections) {
          try {
            // Map names to IDs
            const sourceId = connectionData.sourceType === 'event'
              ? eventMap.get(connectionData.sourceName)
              : entityMap.get(connectionData.sourceName);

            const targetId = connectionData.targetType === 'event'
              ? eventMap.get(connectionData.targetName)
              : entityMap.get(connectionData.targetName);

            if (!sourceId || !targetId) {
              clientLog(`Skipping connection: source or target not found`, connectionData);
              continue;
            }

            // Check if connection already exists (same source, target, and relationship type)
            const isDuplicate = existingConnections.some((conn: any) => {
              const connSourceId = conn.sourceId?._id || conn.sourceId;
              const connTargetId = conn.targetId?._id || conn.targetId;
              return (
                connSourceId.toString() === sourceId.toString() &&
                connTargetId.toString() === targetId.toString() &&
                conn.relationshipType === connectionData.relationshipType
              );
            });

            if (isDuplicate) {
              clientLog(`Connection already exists, skipping: ${connectionData.sourceName} ${connectionData.relationshipType} ${connectionData.targetName}`);
              createdItems.push(`Connection (skipped duplicate): ${connectionData.sourceName} → ${connectionData.targetName}`);
              continue;
            }

            // Convert sourceType/targetType to sourceModel/targetModel (capitalize first letter)
            const sourceModel = connectionData.sourceType === 'event' ? 'Event' : 'Entity';
            const targetModel = connectionData.targetType === 'event' ? 'Event' : 'Entity';

            // Determine connection type based on source and target models
            let connectionType: 'event-entity' | 'event-event' | 'entity-entity';
            if (sourceModel === 'Event' && targetModel === 'Event') {
              connectionType = 'event-event';
            } else if (sourceModel === 'Entity' && targetModel === 'Entity') {
              connectionType = 'entity-entity';
            } else {
              connectionType = 'event-entity';
            }

            const response = await fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: connectionType,
                sourceId,
                targetId,
                sourceModel,
                targetModel,
                relationshipType: connectionData.relationshipType,
                description: connectionData.context, // API uses "description" not "context"
                timelineId,
              }),
            });

            if (response.ok) {
              const connection = await response.json();
              existingConnections.push(connection); // Add to existing connections to prevent duplicates in this batch
              createdItems.push(`Connection (new): ${connectionData.sourceName} → ${connectionData.targetName}`);
              clientLog(`Connection created: ${connectionData.sourceName} ${connectionData.relationshipType} ${connectionData.targetName}`);
            } else if (response.status === 409) {
              // Connection already exists - treat as success
              clientLog(`Connection already exists (from API): ${connectionData.sourceName} ${connectionData.relationshipType} ${connectionData.targetName}`);
              createdItems.push(`Connection (existing): ${connectionData.sourceName} → ${connectionData.targetName}`);
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error(`Failed to create connection:`, {
                connectionData,
                sourceId,
                targetId,
                error: errorData,
                status: response.status
              });
            }
          } catch (error) {
            clientLog(`Failed to create connection:`, connectionData, error);
          }
        }
      }

      if (createdItems.length > 0) {
        const summary = {
          total: createdItems.length,
          newItems: createdItems.filter(item => item.includes('(new)')).length,
          existingItems: createdItems.filter(item => item.includes('(existing)')).length,
          skippedDuplicates: createdItems.filter(item => item.includes('(skipped duplicate)')).length,
        };
        clientLog(`Processing complete:`, summary);
        clientLog(`All items:`, createdItems);
        setCreatingParsedEvent(false);
        // Refresh all panels (map, timeline, entities)
        if (onRefresh) {
          onRefresh();
        } else {
          // Fallback to local refresh if onRefresh not provided
          fetchTimelineData();
          fetchChains();
        }

        setParsedDataDialog(false);
        setParsedData(null);
        setParsedUrl(null);
      } else {
        clientLog('No items were created from parsed data');
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
    // These functions now respect the selected timezone
    const safeTimeFormat = (date: Date, includeMinutes = false, includeAmPm = true) => {
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: timelineTimezone,
        hour: 'numeric',
        minute: includeMinutes ? 'numeric' : undefined,
        hour12: true,
      };

      const formatted = new Intl.DateTimeFormat('en-US', timeOptions).format(date);

      if (!includeAmPm) {
        // Remove AM/PM suffix
        return formatted.replace(/\s?(AM|PM)$/i, '');
      }
      return formatted;
    };

    const safeDateFormat = (date: Date, includeYear = false) => {
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: timelineTimezone,
        month: 'short',
        day: 'numeric',
        year: includeYear ? 'numeric' : undefined,
      };
      return new Intl.DateTimeFormat('en-US', dateOptions).format(date);
    };

    if (duration < 1000 * 60 * 60 * 2) { // Less than 2 hours - show 30min/10min
      mainInterval = 1000 * 60 * 30; // 30 minutes
      subInterval = 1000 * 60 * 10; // 10 minutes
      formatMain = (date) => safeTimeFormat(date, true);
      formatSub = (date) => {
        // Extract just minutes in the selected timezone
        const minuteOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          minute: '2-digit',
        };
        return ':' + new Intl.DateTimeFormat('en-US', minuteOptions).format(date);
      };
    } else if (duration < 1000 * 60 * 60 * 24) { // Less than 1 day - show 2hr/1hr
      mainInterval = 1000 * 60 * 60 * 2; // 2 hours
      subInterval = 1000 * 60 * 60; // 1 hour
      formatMain = (date) => safeTimeFormat(date);
      formatSub = (date) => safeTimeFormat(date, true, false); // Show time with minutes, no AM/PM
    } else if (duration < 1000 * 60 * 60 * 24 * 14) { // Less than 2 weeks - show days
      mainInterval = 1000 * 60 * 60 * 24 * 7; // 1 week
      subInterval = 1000 * 60 * 60 * 24; // 1 day
      formatMain = (date) => safeDateFormat(date);
      formatSub = (date) => {
        // Extract just the day number in the selected timezone
        const dayOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          day: 'numeric',
        };
        return new Intl.DateTimeFormat('en-US', dayOptions).format(date);
      };
    } else if (duration < 1000 * 60 * 60 * 24 * 365) { // Less than 1 year - show months
      mainInterval = 1000 * 60 * 60 * 24 * 30 * 3; // 3 months (quarters)
      subInterval = 1000 * 60 * 60 * 24 * 30; // 1 month
      formatMain = (date) => safeDateFormat(date, true);
      formatSub = (date) => {
        const monthOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          month: 'short',
        };
        return new Intl.DateTimeFormat('en-US', monthOptions).format(date);
      };
    } else if (duration < 1000 * 60 * 60 * 24 * 365 * 10) { // Less than 10 years - show years
      mainInterval = 1000 * 60 * 60 * 24 * 365 * 5; // 5 years
      subInterval = 1000 * 60 * 60 * 24 * 365; // 1 year
      formatMain = (date) => {
        const yearOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          year: 'numeric',
        };
        return new Intl.DateTimeFormat('en-US', yearOptions).format(date);
      };
      formatSub = (date) => {
        const yearOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          year: '2-digit',
        };
        return "'" + new Intl.DateTimeFormat('en-US', yearOptions).format(date);
      };
    } else { // Show decades
      mainInterval = 1000 * 60 * 60 * 24 * 365 * 10; // 10 years (decade)
      subInterval = 1000 * 60 * 60 * 24 * 365 * 5; // 5 years
      formatMain = (date) => {
        const yearOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          year: 'numeric',
        };
        return new Intl.DateTimeFormat('en-US', yearOptions).format(date);
      };
      formatSub = (date) => {
        const yearOptions: Intl.DateTimeFormatOptions = {
          timeZone: timelineTimezone,
          year: '2-digit',
        };
        return "'" + new Intl.DateTimeFormat('en-US', yearOptions).format(date);
      };
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
      <Box ref={headerRef} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {/* Title Bar */}
        <Box sx={{ p: 2, pb: 0 }}>
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
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ px: 2 }}>
          <Tab label="View" sx={{ minHeight: 48, textTransform: 'none' }} />
          <Tab label="Add Content" sx={{ minHeight: 48, textTransform: 'none' }} />
          <Tab label="Filter" sx={{ minHeight: 48, textTransform: 'none' }} />
        </Tabs>

        {/* Tab Panels */}
        <Box sx={{ p: 2 }}>
          {/* Tab 0: View (Zoom + Timezone) */}
          {activeTab === 0 && (
            <Box>
              {/* Zoom Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

              {/* Timezone Selector and Scale Slider */}
              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                {/* Timezone - Left Half */}
                <Box sx={{ flex: '0 0 48%' }}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: '0.875rem' }}>Timezone</InputLabel>
                    <Select
                      value={timelineTimezone}
                      onChange={(e) => handleTimezoneUpdate(e.target.value)}
                      label="Timezone"
                      sx={{ fontSize: '0.875rem' }}
                    >
                      <MenuItem value="UTC" sx={{ fontSize: '0.875rem' }}>UTC</MenuItem>
                      <MenuItem value="America/New_York" sx={{ fontSize: '0.875rem' }}>Eastern Time (US)</MenuItem>
                      <MenuItem value="America/Chicago" sx={{ fontSize: '0.875rem' }}>Central Time (US)</MenuItem>
                      <MenuItem value="America/Denver" sx={{ fontSize: '0.875rem' }}>Mountain Time (US)</MenuItem>
                      <MenuItem value="America/Los_Angeles" sx={{ fontSize: '0.875rem' }}>Pacific Time (US)</MenuItem>
                      <MenuItem value="America/Anchorage" sx={{ fontSize: '0.875rem' }}>Alaska Time (US)</MenuItem>
                      <MenuItem value="Pacific/Honolulu" sx={{ fontSize: '0.875rem' }}>Hawaii Time (US)</MenuItem>
                      <MenuItem value="Europe/London" sx={{ fontSize: '0.875rem' }}>London (GMT/BST)</MenuItem>
                      <MenuItem value="Europe/Paris" sx={{ fontSize: '0.875rem' }}>Paris (CET/CEST)</MenuItem>
                      <MenuItem value="Europe/Berlin" sx={{ fontSize: '0.875rem' }}>Berlin (CET/CEST)</MenuItem>
                      <MenuItem value="Europe/Moscow" sx={{ fontSize: '0.875rem' }}>Moscow (MSK)</MenuItem>
                      <MenuItem value="Asia/Dubai" sx={{ fontSize: '0.875rem' }}>Dubai (GST)</MenuItem>
                      <MenuItem value="Asia/Kolkata" sx={{ fontSize: '0.875rem' }}>India (IST)</MenuItem>
                      <MenuItem value="Asia/Shanghai" sx={{ fontSize: '0.875rem' }}>China (CST)</MenuItem>
                      <MenuItem value="Asia/Tokyo" sx={{ fontSize: '0.875rem' }}>Japan (JST)</MenuItem>
                      <MenuItem value="Asia/Seoul" sx={{ fontSize: '0.875rem' }}>Korea (KST)</MenuItem>
                      <MenuItem value="Australia/Sydney" sx={{ fontSize: '0.875rem' }}>Sydney (AEDT/AEST)</MenuItem>
                      <MenuItem value="Pacific/Auckland" sx={{ fontSize: '0.875rem' }}>Auckland (NZDT/NZST)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Scale - Right Half */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                    Scale
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Few</Typography>
                    <Slider
                      value={scaleMarks}
                      onChange={(_, value) => setScaleMarks(value as number)}
                      sx={{ flex: 1 }}
                      min={3}
                      max={20}
                      size="small"
                      valueLabelDisplay="auto"
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Many</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Tab 1: Add Content (Quick Add from URL or File) */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Quick add from URL"
                    value={quickAddUrl}
                    onChange={(e) => {
                      setQuickAddUrl(e.target.value);
                      setParseError(null);
                      if (e.target.value) setSelectedFile(null);
                    }}
                    disabled={urlParsing || fileParsing || !!selectedFile}
                    sx={{ flex: 1 }}
                    error={!!parseError}
                    InputProps={{
                      startAdornment: <Link sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />,
                    }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      ref={fileInputRef}
                      accept=".txt,.md,.json,.csv"
                      style={{ display: 'none' }}
                      id="quick-add-file-upload"
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          setQuickAddUrl('');
                          setParseError(null);
                        }
                      }}
                      disabled={urlParsing || fileParsing || !!quickAddUrl}
                    />
                    <label htmlFor="quick-add-file-upload">
                      <Button
                        component="span"
                        variant="outlined"
                        size="small"
                        disabled={urlParsing || fileParsing || !!quickAddUrl}
                        startIcon={<CloudUpload fontSize="small" />}
                      >
                        Upload
                      </Button>
                    </label>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleParse}
                      disabled={
                        (urlParsing || fileParsing) ||
                        (!selectedFile && (!quickAddUrl.trim() || !isValidUrl(quickAddUrl)))
                      }
                      startIcon={(urlParsing || fileParsing) ? <CircularProgress size={16} /> : undefined}
                    >
                      {(urlParsing || fileParsing) ? `Parsing... ${parsingElapsed}s` : 'Go'}
                    </Button>
                  </Box>
                </Box>
                {selectedFile && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Selected: {selectedFile.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedFile(null);
                        setParseError(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      disabled={urlParsing || fileParsing}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                )}
                {parseError && (
                  <Typography variant="caption" color="error">
                    {parseError}
                  </Typography>
                )}
              </Box>

              {parseError && parseError.includes('Ollama') && (
                <Alert severity="info" sx={{ mt: 1, fontSize: '0.875rem' }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Ollama LLM not available.</strong> To enable URL/file parsing:
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    1. Install: <code>curl -fsSL https://ollama.ai/install.sh | sh</code><br/>
                    2. Start: <code>ollama serve</code><br/>
                    3. Pull model: <code>ollama pull llama3.2</code>
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Tab 2: Filter (Chain Filter Panel) */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FilterList fontSize="small" />
                  Event Chains
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setChainManagerOpen(true)}
                    sx={{ fontSize: '0.7rem', py: 0.5, minHeight: 0, textTransform: 'none' }}
                  >
                    Manage Chains
                  </Button>
                  {chains.length > 0 && activeChainIds.size > 0 && (
                    <Button
                      size="small"
                      onClick={clearAllChainFilters}
                      sx={{ fontSize: '0.7rem', py: 0.5, minHeight: 0, textTransform: 'none' }}
                    >
                      Clear
                    </Button>
                  )}
                  {chains.length > 0 && activeChainIds.size < chains.length && (
                    <Button
                      size="small"
                      onClick={selectAllChainFilters}
                      sx={{ fontSize: '0.7rem', py: 0.5, minHeight: 0, textTransform: 'none' }}
                    >
                      All
                    </Button>
                  )}
                </Box>
              </Box>
              {chains.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {chains.map((chain) => (
                      <Chip
                        key={chain._id}
                        label={chain.name}
                        size="small"
                        onClick={() => toggleChainFilter(chain._id)}
                        sx={{
                          backgroundColor: activeChainIds.has(chain._id) ? chain.color : 'transparent',
                          color: activeChainIds.has(chain._id) ? '#fff' : 'text.secondary',
                          border: '1px solid',
                          borderColor: chain.color,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: chain.color,
                            color: '#fff',
                            opacity: 0.8,
                          },
                        }}
                      />
                    ))}
                  </Box>
                  {activeChainIds.size > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Showing events in {activeChainIds.size === 1 ? '1 chain' : `${activeChainIds.size} chains`}
                    </Typography>
                  )}
                </>
              )}
              {chains.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                  No chains yet. Click "Manage Chains" to create your first chain.
                </Typography>
              )}
            </Box>
          )}
        </Box>
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
          const visibleEvents = getVisibleEvents();

          if (visibleEvents.length === 0 && activeChainIds.size > 0) {
            return (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  No events match the selected chain filters.
                </Typography>
              </Box>
            );
          }

          const timeRange = getTimeRange();

          // Timeline height calculation based on available viewport height and zoom level
          // Scroll container is set to exactly availableHeight pixels
          // At 100% zoom: timeline content = availableHeight (fills viewport, no scroll)
          // At 200% zoom: timeline content = 2x availableHeight (double height, scrolls)
          // At 50% zoom: timeline content = 0.5x availableHeight (compressed, no scroll)
          const fallbackHeight = Math.max(1000, visibleEvents.length * 300); // Fallback if viewport not measured yet

          // Calculate additional height needed for expanded (selected) events
          // Collapsed event: ~40px, Expanded event: fit-content with minimum
          const collapsedEventHeight = 40;
          const expandedEventHeight = 80; // Minimum to fit title, date, rating - will grow with content
          const selectedEventCount = visibleEvents.filter(e => isEventSelected(e._id)).length;
          const unselectedEventCount = visibleEvents.length - selectedEventCount;

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
            eventsCount: visibleEvents.length,
            ratio: availableHeight > 0 ? (finalTimelineHeight / availableHeight).toFixed(2) + 'x viewport' : 'using fallback'
          });

          return (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              px: 2,
              py: 4,
            }}>

              {/* Segmented timeline: alternating timeline segments and event cards */}
              {(() => {
                // Sort visible events chronologically
                const sortedEvents = [...visibleEvents].sort((a, b) =>
                  new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
                );

                // Build hierarchical structure based on time containment
                interface EventNode {
                  event: Event;
                  children: EventNode[];
                  depth: number;
                }

                const buildEventHierarchy = (events: Event[]): EventNode[] => {
                  const roots: EventNode[] = [];
                  const processed = new Set<string>();

                  // Helper to check if event A contains event B temporally
                  const contains = (a: Event, b: Event): boolean => {
                    if (!a.endDateTime) return false; // Events without end date can't contain others

                    const aStart = new Date(a.startDateTime).getTime();
                    const aEnd = new Date(a.endDateTime).getTime();
                    const bStart = new Date(b.startDateTime).getTime();
                    const bEnd = b.endDateTime ? new Date(b.endDateTime).getTime() : bStart;

                    return bStart >= aStart && bEnd <= aEnd && a._id !== b._id;
                  };

                  // Build tree recursively
                  const buildNode = (event: Event, depth: number, parentEnd?: number): EventNode => {
                    const node: EventNode = {
                      event,
                      children: [],
                      depth,
                    };

                    const eventEnd = event.endDateTime ? new Date(event.endDateTime).getTime() : new Date(event.startDateTime).getTime();

                    // Find children: events that this event contains and haven't been processed
                    for (const candidateEvent of events) {
                      if (!processed.has(candidateEvent._id) && contains(event, candidateEvent)) {
                        // Make sure child doesn't extend beyond parent if parent has a parent
                        if (parentEnd === undefined || new Date(candidateEvent.startDateTime).getTime() < parentEnd) {
                          processed.add(candidateEvent._id);
                          node.children.push(buildNode(candidateEvent, depth + 1, eventEnd));
                        }
                      }
                    }

                    // Sort children chronologically
                    node.children.sort((a, b) =>
                      new Date(a.event.startDateTime).getTime() - new Date(b.event.startDateTime).getTime()
                    );

                    return node;
                  };

                  // Build root nodes (events not contained by any other event)
                  for (const event of events) {
                    if (!processed.has(event._id)) {
                      const isContained = events.some(otherEvent =>
                        otherEvent._id !== event._id && contains(otherEvent, event)
                      );

                      if (!isContained) {
                        processed.add(event._id);
                        roots.push(buildNode(event, 0));
                      }
                    }
                  }

                  return roots;
                };

                const eventHierarchy = buildEventHierarchy(sortedEvents);

                // Flatten hierarchy into a list with depth information
                const flattenHierarchy = (nodes: EventNode[]): Array<{event: Event, depth: number}> => {
                  const result: Array<{event: Event, depth: number}> = [];

                  const traverse = (node: EventNode) => {
                    result.push({ event: node.event, depth: node.depth });
                    node.children.forEach(traverse);
                  };

                  nodes.forEach(traverse);
                  return result;
                };

                const flattenedEvents = flattenHierarchy(eventHierarchy);

                // Calculate temporal positions for all events (0-100%)
                const eventTemporalData = flattenedEvents.map(({event, depth}) => {
                  const startTemporalPosition = getEventPosition(event.startDateTime, timeRange);
                  const endDateTime = event.endDateTime || event.startDateTime;
                  const endTemporalPosition = getEventPosition(endDateTime, timeRange);
                  const isSelected = isEventSelected(event._id);

                  return {
                    event,
                    startPercent: startTemporalPosition,
                    endPercent: endTemporalPosition,
                    isSelected,
                    depth,
                  };
                });

                // Create segments: alternating timeline portions and event cards
                const segments: Array<{type: 'timeline' | 'event' | 'spacer', startPercent: number, endPercent: number, event?: any, isSelected?: boolean, depth?: number}> = [];

                let currentPercent = 0;
                eventTemporalData.forEach((eventData, index) => {
                  const { event, startPercent, endPercent, isSelected, depth } = eventData;

                  // Add timeline segment before this event
                  const durationBeforeEvent = startPercent - currentPercent;
                  if (durationBeforeEvent > 0.5) {
                    // Meaningful gap - render timeline segment with marks
                    segments.push({
                      type: 'timeline',
                      startPercent: currentPercent,
                      endPercent: startPercent,
                    });
                  } else if (durationBeforeEvent > 0) {
                    // Very small gap - render spacer with just vertical line
                    segments.push({
                      type: 'spacer',
                      startPercent: currentPercent,
                      endPercent: startPercent,
                    });
                  }

                  // Add event segment
                  segments.push({
                    type: 'event',
                    startPercent,
                    endPercent,
                    event,
                    isSelected,
                    depth,
                  });

                  currentPercent = endPercent;
                });

                // Add final timeline segment after last event
                if (currentPercent < 100) {
                  segments.push({
                    type: 'timeline',
                    startPercent: currentPercent,
                    endPercent: 100,
                  });
                }

                // Render segments
                return segments.map((segment, segIndex) => {
                  if (segment.type === 'timeline') {
                    // Timeline segment with marks
                    const segmentDuration = segment.endPercent - segment.startPercent;
                    const segmentHeight = (segmentDuration / 100) * finalTimelineHeight;

                    // Check if there's an event segment immediately after this one
                    const nextSegment = segments[segIndex + 1];
                    const hasEventAfter = nextSegment?.type === 'event';

                    // Find marks in this segment
                    let segmentMarks = timeMarks.filter(mark =>
                      mark.position >= segment.startPercent && mark.position <= segment.endPercent
                    );

                    // If there's an event card after this timeline segment,
                    // remove marks that are very close to the bottom (event's top border)
                    if (hasEventAfter) {
                      const threshold = 1.5; // percent of total timeline
                      segmentMarks = segmentMarks.filter(mark => {
                        const distanceFromBottom = segment.endPercent - mark.position;
                        return distanceFromBottom > threshold;
                      });
                    }

                    return (
                      <Box
                        key={`segment-${segIndex}`}
                        sx={{
                          position: 'relative',
                          minHeight: segmentHeight,
                          width: '100%',
                        }}
                      >
                        {/* Vertical timeline line */}
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

                        {/* Scale marks for this segment */}
                        {segmentMarks.map((mark, markIndex) => {
                          const isMicroMark = mark.label === '·';
                          const markPositionInSegment = ((mark.position - segment.startPercent) / segmentDuration) * 100;

                          return (
                            <Box key={`mark-${segIndex}-${markIndex}`}>
                              {/* Scale mark */}
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: mark.isMainMark ? 'calc(50% - 15px)' :
                                         isMicroMark ? 'calc(50% - 2px)' : 'calc(50% - 10px)',
                                  top: `${markPositionInSegment}%`,
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
                                    top: `${markPositionInSegment}%`,
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
                      </Box>
                    );
                  } else if (segment.type === 'spacer') {
                    // Small spacer with just vertical line
                    return (
                      <Box
                        key={`segment-${segIndex}`}
                        sx={{
                          position: 'relative',
                          height: 5,
                          width: '100%',
                        }}
                      >
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
                      </Box>
                    );
                  } else {
                    // Event card segment
                    const event = segment.event!;
                    const isSelected = segment.isSelected!;
                    const depth = segment.depth || 0;
                    const indentAmount = depth * 3; // 3rem per nesting level

                  return (
                    <Box
                      key={event._id}
                      sx={{
                        width: '100%',
                        px: 1,
                        pl: `${1 + indentAmount}rem`, // Add left padding based on depth
                      }}
                    >
                      {/* Event card */}
                      <Card
                      ref={(el) => {
                        eventRefs.current[event._id] = el;
                      }}
                      data-event-id={event._id}
                      sx={{
                        width: '100%',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        borderLeft: depth > 0 ? `4px solid` : undefined,
                        borderLeftColor: depth > 0 ? 'primary.light' : undefined,
                        '&:hover': { elevation: 2 },
                        backgroundColor: isSelected ? 'primary.50' : (depth > 0 ? 'grey.50' : 'background.paper'),
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
                              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 'bold' }} className="event-name">
                                  {event.title}
                                </Typography>
                                {/* Chain indicators */}
                                {event.chainIds && event.chainIds.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', ml: 0.5 }}>
                                    {event.chainIds.slice(0, 3).map((chainId) => {
                                      const chain = chains.find(c => c._id === chainId);
                                      if (!chain) return null;
                                      return (
                                        <Tooltip key={chainId} title={chain.name} arrow>
                                          <Box
                                            sx={{
                                              width: 10,
                                              height: 10,
                                              borderRadius: '50%',
                                              backgroundColor: chain.color,
                                              border: '1px solid rgba(255,255,255,0.5)',
                                            }}
                                          />
                                        </Tooltip>
                                      );
                                    })}
                                    {event.chainIds.length > 3 && (
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', ml: 0.25 }}>
                                        +{event.chainIds.length - 3}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
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
                            <Typography variant="body2" color="primary" sx={{ mb: 0.5, fontSize: '0.8rem' }}>
                              {formatDateInTimezone(event.startDateTime, 'PPpp')}
                              {event.endDateTime && (
                                <span> - {formatDateInTimezone(event.endDateTime, 'PPpp')}</span>
                              )}
                            </Typography>

                            {/* Location */}
                            {event.locationId && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.75rem', fontStyle: 'italic' }}>
                                📍 {event.locationId.name}
                              </Typography>
                            )}
                          </>
                        ) : (
                          /* Collapsed view: title on left, date and chain indicators on right */
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {/* Title - can truncate */}
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
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              {event.title}
                            </Typography>
                            {/* Date/time and chain indicators - right-aligned */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                              {/* Date/time - always visible */}
                              <Typography
                                variant="body2"
                                color="primary"
                                sx={{
                                  fontSize: '0.75rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatDateInTimezone(event.startDateTime, 'MMM d, yyyy h:mm a')}
                                {event.endDateTime && ` - ${formatDateInTimezone(event.endDateTime, 'h:mm a')}`}
                              </Typography>
                              {/* Chain indicators */}
                              {event.chainIds && event.chainIds.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                                  {event.chainIds.slice(0, 2).map((chainId) => {
                                    const chain = chains.find(c => c._id === chainId);
                                    if (!chain) return null;
                                    return (
                                      <Box
                                        key={chainId}
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          backgroundColor: chain.color,
                                          border: '1px solid rgba(255,255,255,0.5)',
                                        }}
                                      />
                                    );
                                  })}
                                  {event.chainIds.length > 2 && (
                                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                                      +{event.chainIds.length - 2}
                                    </Typography>
                                  )}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        )}

                        {/* Only show when selected: description and attachments */}
                        {isSelected && (
                          <>
                            {event.description && (
                              <Box>
                                <Typography
                                  ref={(el) => descriptionRefs.current[event._id] = el}
                                  component="div"
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    mb: 0.5,
                                    fontSize: '0.8rem',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {renderDescriptionWithFootnotes(event.description, event)}
                                </Typography>
                                {descriptionOverflows[event._id] && (
                                  <Button
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventDetail(event);
                                      setEventDetailOpen(true);
                                    }}
                                    sx={{
                                      textTransform: 'none',
                                      fontSize: '0.75rem',
                                      p: 0,
                                      minWidth: 'auto',
                                      '&:hover': {
                                        backgroundColor: 'transparent',
                                        textDecoration: 'underline',
                                      }
                                    }}
                                  >
                                    Read more...
                                  </Button>
                                )}
                              </Box>
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
                                        {link.title || link.url}
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
                  }
                });
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
            disabled={creatingParsedEvent || !parsedData || (!parsedData.events?.length && !parsedData.entities?.length && !parsedData.locations?.length)}
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

      {/* Chain Manager Modal */}
      <ChainManagerModal
        open={chainManagerOpen}
        onClose={() => setChainManagerOpen(false)}
        timelineId={timelineId}
        onChainCreated={() => {
          fetchChains();
          fetchTimelineData();
        }}
      />

      {/* Parsing Progress Modal */}
      <ParsingProgressModal
        open={showParsingProgress}
        tokenCount={estimatedTokenCount}
        parsingType={currentParsingType}
        fileName={currentFileName}
      />

      {/* Event Detail Modal */}
      <Dialog
        open={eventDetailOpen}
        onClose={() => {
          setEventDetailOpen(false);
          setSelectedEventDetail(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" component="div">
                {selectedEventDetail?.title}
              </Typography>
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedEventDetail && formatDateInTimezone(selectedEventDetail.startDateTime, 'PPpp')}
                {selectedEventDetail?.endDateTime && (
                  <span> - {formatDateInTimezone(selectedEventDetail.endDateTime, 'PPpp')}</span>
                )}
              </Typography>
              {selectedEventDetail?.locationId && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                  📍 {selectedEventDetail.locationId.name}
                </Typography>
              )}
            </Box>
            <Rating
              value={selectedEventDetail?.importance || 0}
              readOnly
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEventDetail?.description && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Description
              </Typography>
              <Typography component="div" variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {renderDescriptionWithFootnotes(selectedEventDetail.description, selectedEventDetail)}
              </Typography>
            </Box>
          )}

          {/* Attachments in modal */}
          {selectedEventDetail && eventAttachments[selectedEventDetail._id] && eventAttachments[selectedEventDetail._id].length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Attachments ({eventAttachments[selectedEventDetail._id].length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {eventAttachments[selectedEventDetail._id].map((attachment) => (
                  <Tooltip key={attachment._id} title={attachment.originalName} arrow>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.8 },
                      }}
                      onClick={() => handleAttachmentClick(attachment)}
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
                          fontSize: '24px'
                        }}>
                          {attachment.mimeType.startsWith('video/') ? '🎥' :
                           attachment.mimeType.startsWith('audio/') ? '🎵' : '📄'}
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          {/* Links in modal */}
          {selectedEventDetail && eventLinks[selectedEventDetail._id] && eventLinks[selectedEventDetail._id].length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Links ({eventLinks[selectedEventDetail._id].length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {eventLinks[selectedEventDetail._id].map((link) => (
                  <Typography
                    key={link._id}
                    component="a"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      fontSize: '0.875rem',
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {link.title || link.url}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEventDetailOpen(false);
              setSelectedEventDetail(null);
            }}
          >
            Close
          </Button>
          {selectedEventDetail && onEditEvent && (
            <Button
              variant="contained"
              onClick={() => {
                onEditEvent(selectedEventDetail._id);
                setEventDetailOpen(false);
                setSelectedEventDetail(null);
              }}
              startIcon={<Edit />}
            >
              Edit Event
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}