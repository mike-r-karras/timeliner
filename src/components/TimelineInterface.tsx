'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Fab, Menu, MenuItem, AppBar, Toolbar, Typography, Switch, FormControlLabel } from '@mui/material';
import { Add, LocationOn, Timeline as TimelineIcon, People, AccountTree } from '@mui/icons-material';
import ResizablePanels from './ResizablePanels';
import MapPanel from './MapPanel';
import TimelinePanel from './TimelinePanel';
import EntitiesPanel from './EntitiesPanel';
import EventModal from './EventModal';
import EntityModal from './EntityModal';
import LocationModal from './LocationModal';
import ConnectionManager from './ConnectionManager';

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

  // Connection-related states
  const [showConnections, setShowConnections] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingSource, setConnectingSource] = useState<{
    type: 'event' | 'entity';
    id: string;
    name: string;
  } | null>(null);

  // Initialize or load user's timeline
  useEffect(() => {
    initializeTimeline();
  }, [userId]);

  const initializeTimeline = async () => {
    try {
      const response = await fetch('/api/timelines/current', {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const timeline = await response.json();
        setCurrentTimelineId(timeline._id);
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

  // Connection handlers
  const handleStartConnection = (sourceType: 'event' | 'entity', sourceId: string, sourceName: string) => {
    setConnectingSource({ type: sourceType, id: sourceId, name: sourceName });
    setIsConnecting(true);
  };

  const handleConnectionComplete = () => {
    setIsConnecting(false);
    setConnectingSource(null);
    triggerRefresh();
  };

  const handleConnectionTarget = (targetType: 'event' | 'entity', targetId: string, targetName: string) => {
    if (!isConnecting || !connectingSource) return;

    // Don't connect to self
    if (targetId === connectingSource.id) return;

    // Call the connection handler via global reference
    if ((window as any).connectionManagerHandler) {
      (window as any).connectionManagerHandler(targetType, targetId, targetName);
    }
  };

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
            onStartConnection={handleStartConnection}
            isConnecting={isConnecting}
            onConnectionTarget={handleConnectionTarget}
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
            onStartConnection={handleStartConnection}
            isConnecting={isConnecting}
            onConnectionTarget={handleConnectionTarget}
          />
        );
        break;
    }

    return { ...panel, component };
  }), [panels, currentTimelineId, selectedItems, refreshTrigger, filteredEntityIds, locationModalCoords, isConnecting, connectingSource]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top bar for controls */}
      <AppBar position="static" sx={{ zIndex: 1200 }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Timeline Controls
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showConnections}
                onChange={(e) => setShowConnections(e.target.checked)}
                size="small"
              />
            }
            label="Show Relationships"
            sx={{ color: 'inherit' }}
          />
          {isConnecting && (
            <Typography variant="body2" sx={{ ml: 2, color: 'warning.light' }}>
              <AccountTree sx={{ mr: 1, verticalAlign: 'middle' }} />
              Connecting from: {connectingSource?.name}
            </Typography>
          )}
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

      {/* Connection Manager */}
      <ConnectionManager
        timelineId={currentTimelineId}
        showConnections={showConnections}
        isConnecting={isConnecting}
        connectingSource={connectingSource}
        onConnectionComplete={handleConnectionComplete}
        refreshTrigger={refreshTrigger}
        onConnectionTarget={handleConnectionTarget}
      />
    </Box>
  );
}