'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Fab, Menu, MenuItem, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { Add, LocationOn, Timeline as TimelineIcon, People, AccountTree, Menu as MenuIcon } from '@mui/icons-material';
import ResizablePanels from './ResizablePanels';
import MapPanel from './MapPanel';
import TimelinePanel from './TimelinePanel';
import EntitiesPanel from './EntitiesPanel';
import EventModal from './EventModal';
import EntityModal from './EntityModal';
import LocationModal from './LocationModal';
import ConnectionManagerModal from './ConnectionManagerModal';
import TimelineManager from './TimelineManager';

interface TimelineInterfaceProps {
  userId: string;
}

interface SelectedItems {
  events: string[];
  entities: string[];
  locations: string[];
}

export default function TimelineInterface({ userId }: TimelineInterfaceProps) {
  const [panels, setPanels] = useState([
    {
      id: 'map',
      title: 'Map',
      component: <MapPanel />,
      isVisible: true,
      width: 400,
      minWidth: 300,
    },
    {
      id: 'timeline',
      title: 'Timeline',
      component: <TimelinePanel />,
      isVisible: true,
      width: 600,
      minWidth: 400,
    },
    {
      id: 'entities',
      title: 'Entities',
      component: <EntitiesPanel />,
      isVisible: true,
      width: 300,
      minWidth: 250,
    },
  ]);

  const [selectedItems, setSelectedItems] = useState<SelectedItems>({
    events: [],
    entities: [],
    locations: [],
  });

  const [currentTimelineId, setCurrentTimelineId] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [locationModalCoords, setLocationModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityModalDefaultType, setEntityModalDefaultType] = useState<string | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filteredEntityIds, setFilteredEntityIds] = useState<string[]>([]);
  const [visibleEventIds, setVisibleEventIds] = useState<string[]>([]);
  const [timelineManagerOpen, setTimelineManagerOpen] = useState(false);
  const [currentTimelineTitle, setCurrentTimelineTitle] = useState<string>('');
  const [mapReady, setMapReady] = useState(false);

  // Connection manager modal state
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false);

  // Initialize or load user's timeline
  useEffect(() => {
    initializeTimeline();
  }, [userId]);

  // Save current timeline ID to localStorage when it changes
  useEffect(() => {
    if (currentTimelineId) {
      localStorage.setItem('timeliner:currentTimelineId', currentTimelineId);
    }
  }, [currentTimelineId]);

  // Restore selected items when timeline changes
  useEffect(() => {
    if (currentTimelineId) {
      const savedSelection = localStorage.getItem(`timeliner:selection:${currentTimelineId}`);
      if (savedSelection) {
        try {
          const parsed = JSON.parse(savedSelection);
          setSelectedItems(parsed);
        } catch (error) {
          console.error('Error parsing saved selection:', error);
        }
      } else {
        // Clear selection when switching to a timeline without saved selection
        setSelectedItems({ events: [], entities: [], locations: [] });
      }
    }
  }, [currentTimelineId]);

  // Save selected items to localStorage when they change
  useEffect(() => {
    if (currentTimelineId) {
      localStorage.setItem(`timeliner:selection:${currentTimelineId}`, JSON.stringify(selectedItems));
    }
  }, [selectedItems, currentTimelineId]);

  // Fetch connected entities when visible events change
  useEffect(() => {
    const fetchConnectedEntities = async () => {
      // Check if timeline panel is visible
      const timelinePanel = panels.find(p => p.id === 'timeline');
      const isTimelinePanelVisible = timelinePanel?.isVisible;

      // If timeline panel is hidden, clear the filter
      if (!isTimelinePanelVisible) {
        setFilteredEntityIds([]);
        return;
      }

      // If no visible events, clear the filter
      if (!currentTimelineId || visibleEventIds.length === 0) {
        setFilteredEntityIds([]);
        return;
      }

      try {
        const response = await fetch(`/api/connections?timelineId=${currentTimelineId}&eventIds=${visibleEventIds.join(',')}`);
        if (response.ok) {
          const connections = await response.json();

          // Extract entity IDs from connections
          const entityIds = new Set<string>();
          connections.forEach((conn: any) => {
            // If source is an event and target is an entity, add target
            if (conn.sourceModel === 'Event' && conn.targetModel === 'Entity' && visibleEventIds.includes(conn.sourceId._id || conn.sourceId)) {
              entityIds.add(conn.targetId._id || conn.targetId);
            }
            // If target is an event and source is an entity, add source
            if (conn.targetModel === 'Event' && conn.sourceModel === 'Entity' && visibleEventIds.includes(conn.targetId._id || conn.targetId)) {
              entityIds.add(conn.sourceId._id || conn.sourceId);
            }
          });

          setFilteredEntityIds(Array.from(entityIds));
        }
      } catch (error) {
        console.error('Error fetching connected entities:', error);
      }
    };

    fetchConnectedEntities();
  }, [currentTimelineId, visibleEventIds, panels]);

  const initializeTimeline = async () => {
    try {
      // First check localStorage for saved timeline ID
      const savedTimelineId = localStorage.getItem('timeliner:currentTimelineId');

      if (savedTimelineId) {
        // Try to load the saved timeline
        try {
          const response = await fetch(`/api/timelines/${savedTimelineId}`);
          if (response.ok) {
            const timeline = await response.json();
            setCurrentTimelineId(timeline._id);
            setCurrentTimelineTitle(timeline.title);
            return;
          }
        } catch (error) {
          console.error('Error loading saved timeline:', error);
          // Continue to fetch current timeline
        }
      }

      // If no saved timeline or it failed to load, fetch current timeline
      const response = await fetch('/api/timelines/current', {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const timeline = await response.json();
        setCurrentTimelineId(timeline._id);
        setCurrentTimelineTitle(timeline.title);
      } else {
        // Create default timeline
        const createResponse = await fetch('/api/timelines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Untitled' }),
        });

        if (createResponse.ok) {
          const newTimeline = await createResponse.json();
          setCurrentTimelineId(newTimeline._id);
          setCurrentTimelineTitle(newTimeline.title);
          // Open add event modal for new timelines
          setEventModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Error initializing timeline:', error);
    }
  };

  const handlePanelVisibilityChange = (panelId: string, isVisible: boolean) => {
    setPanels(prev =>
      prev.map(panel =>
        panel.id === panelId ? { ...panel, isVisible } : panel
      )
    );
  };

  const handlePanelReorder = (dragIndex: number, hoverIndex: number) => {
    setPanels(prev => {
      const newPanels = [...prev];
      const draggedPanel = newPanels[dragIndex];
      newPanels.splice(dragIndex, 1);
      newPanels.splice(hoverIndex, 0, draggedPanel);
      return newPanels;
    });
  };

  const handleSelection = (type: 'event' | 'entity' | 'location', ids: string[], append: boolean = false) => {
    setSelectedItems(prev => {
      const newSelected = { ...prev };
      if (append) {
        const currentIds = newSelected[type === 'event' ? 'events' : type === 'entity' ? 'entities' : 'locations'];
        const updatedIds = [...currentIds];

        // Toggle each ID - add if not present, remove if already present
        ids.forEach(id => {
          const existingIndex = updatedIds.indexOf(id);
          if (existingIndex === -1) {
            // Not selected, add it
            updatedIds.push(id);
          } else {
            // Already selected, remove it
            updatedIds.splice(existingIndex, 1);
          }
        });

        newSelected[type === 'event' ? 'events' : type === 'entity' ? 'entities' : 'locations'] = updatedIds;
      } else {
        newSelected.events = type === 'event' ? ids : [];
        newSelected.entities = type === 'entity' ? ids : [];
        newSelected.locations = type === 'location' ? ids : [];
      }
      return newSelected;
    });
  };

  const handleAddMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  };

  const handleAddMenuClose = () => {
    setAddMenuAnchor(null);
  };

  const handleAddEvent = () => {
    setEditingEventId(null);
    setEventModalOpen(true);
    handleAddMenuClose();
  };

  const handleEditEvent = (eventId: string) => {
    setEditingEventId(eventId);
    setEventModalOpen(true);
  };

  const handleAddEntity = () => {
    setEditingEntityId(null);
    setEntityModalDefaultType(undefined);
    setEntityModalOpen(true);
    handleAddMenuClose();
  };

  const handleEditEntity = (entityId: string) => {
    setEditingEntityId(entityId);
    setEntityModalDefaultType(undefined);
    setEntityModalOpen(true);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEntitiesFiltered = useCallback((entityIds: string[]) => {
    setFilteredEntityIds(entityIds);
  }, []);

  const handleAddLocation = () => {
    setEditingEntityId(null);
    setEntityModalDefaultType('place');
    setEntityModalOpen(true);
    handleAddMenuClose();
  };

  const handleMapLocationAdd = (lat: number, lng: number) => {
    setLocationModalCoords({ lat, lng });
    setLocationModalOpen(true);
  };

  const handleLocationCreated = () => {
    setLocationModalOpen(false);
    setLocationModalCoords(null);
    triggerRefresh();
  };


  // Timeline management handlers
  const handleTimelineChange = async (timelineId: string) => {
    setCurrentTimelineId(timelineId);
    triggerRefresh();

    // Update current timeline title
    try {
      const response = await fetch(`/api/timelines/${timelineId}`);
      if (response.ok) {
        const timeline = await response.json();
        setCurrentTimelineTitle(timeline.title);
      }
    } catch (error) {
      console.error('Error fetching timeline details:', error);
    }
  };

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  // Update panel components with current state
  const updatedPanels = useMemo(() => panels.map(panel => {
    let component = panel.component;

    switch (panel.id) {
      case 'map':
        component = (
          <MapPanel
            timelineId={currentTimelineId}
            selectedItems={selectedItems}
            onSelection={handleSelection}
            onAddLocation={handleMapLocationAdd}
            refreshTrigger={refreshTrigger}
            filteredEntityIds={filteredEntityIds}
            visibleEventIds={visibleEventIds}
            onMapReady={handleMapReady}
          />
        );
        break;
      case 'timeline':
        component = (
          <TimelinePanel
            timelineId={currentTimelineId}
            selectedItems={selectedItems}
            onSelection={handleSelection}
            onEditEvent={handleEditEvent}
            onAddEvent={handleAddEvent}
            refreshTrigger={refreshTrigger}
            onRefresh={triggerRefresh}
            onVisibleEventsChange={setVisibleEventIds}
            mapReady={mapReady}
          />
        );
        break;
      case 'entities':
        component = (
          <EntitiesPanel
            timelineId={currentTimelineId}
            selectedItems={selectedItems}
            onSelection={handleSelection}
            onEditEntity={handleEditEntity}
            onAddEntity={handleAddEntity}
            refreshTrigger={refreshTrigger}
            onEntitiesFiltered={handleEntitiesFiltered}
            visibleEventIds={visibleEventIds}
          />
        );
        break;
    }

    return { ...panel, component };
  }), [panels, currentTimelineId, selectedItems, refreshTrigger, filteredEntityIds, locationModalCoords, mapReady, visibleEventIds]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top bar for controls */}
      <AppBar position="static" sx={{ zIndex: 1200 }}>
        <Toolbar variant="dense">
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setTimelineManagerOpen(true)}
              sx={{ color: 'inherit' }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6">
              {currentTimelineTitle || 'Timeline'}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setConnectionManagerOpen(true)}
            sx={{ color: 'inherit' }}
            title="Connection Manager"
          >
            <AccountTree />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main panels */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <ResizablePanels
          panels={updatedPanels}
          onPanelVisibilityChange={handlePanelVisibilityChange}
          onPanelReorder={handlePanelReorder}
        />
      </Box>

      {/* Floating Add Button */}
      <Fab
        color="primary"
        sx={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000 }}
        onClick={handleAddMenuOpen}
      >
        <Add />
      </Fab>

      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={handleAddMenuClose}
      >
        <MenuItem onClick={handleAddEvent}>
          <TimelineIcon sx={{ mr: 1 }} />
          Add Event
        </MenuItem>
        <MenuItem onClick={handleAddEntity}>
          <People sx={{ mr: 1 }} />
          Add Entity
        </MenuItem>
        <MenuItem onClick={handleAddLocation}>
          <LocationOn sx={{ mr: 1 }} />
          Add Place
        </MenuItem>
      </Menu>

      {/* Modals */}
      <EventModal
        open={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEventId(null);
        }}
        timelineId={currentTimelineId}
        eventId={editingEventId}
        onEventCreated={() => {
          setEventModalOpen(false);
          setEditingEventId(null);
          triggerRefresh();
        }}
      />

      <EntityModal
        open={entityModalOpen}
        onClose={() => {
          setEntityModalOpen(false);
          setEditingEntityId(null);
          setEntityModalDefaultType(undefined);
        }}
        timelineId={currentTimelineId}
        entityId={editingEntityId}
        defaultType={entityModalDefaultType}
        onEntityCreated={() => {
          setEntityModalOpen(false);
          setEditingEntityId(null);
          setEntityModalDefaultType(undefined);
          triggerRefresh();
        }}
      />

      <LocationModal
        open={locationModalOpen}
        onClose={() => {
          setLocationModalOpen(false);
          setLocationModalCoords(null);
        }}
        onLocationCreated={handleLocationCreated}
        initialCoordinates={locationModalCoords}
      />

      {/* Connection Manager Modal */}
      <ConnectionManagerModal
        open={connectionManagerOpen}
        onClose={() => setConnectionManagerOpen(false)}
        timelineId={currentTimelineId}
      />

      {/* Timeline Manager */}
      <TimelineManager
        open={timelineManagerOpen}
        onClose={() => setTimelineManagerOpen(false)}
        currentTimelineId={currentTimelineId}
        onTimelineChange={handleTimelineChange}
      />
    </Box>
  );
}