'use client';

import React, { useState, useEffect } from 'react';
import { Box, Fab, Menu, MenuItem } from '@mui/material';
import { Add, LocationOn, Timeline as TimelineIcon, People } from '@mui/icons-material';
import ResizablePanels from './ResizablePanels';
import MapPanel from './MapPanel';
import TimelinePanel from './TimelinePanel';
import EntitiesPanel from './EntitiesPanel';
import EventModal from './EventModal';
import EntityModal from './EntityModal';
import LocationModal from './LocationModal';

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
        newSelected[type === 'event' ? 'events' : type === 'entity' ? 'entities' : 'locations'] = [
          ...currentIds,
          ...ids.filter(id => !currentIds.includes(id))
        ];
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
    setEntityModalOpen(true);
    handleAddMenuClose();
  };

  const handleEditEntity = (entityId: string) => {
    setEditingEntityId(entityId);
    setEntityModalOpen(true);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAddLocation = () => {
    setLocationModalCoords(null);
    setLocationModalOpen(true);
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

  // Update panel components with current state
  const updatedPanels = panels.map(panel => {
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
          />
        );
        break;
    }

    return { ...panel, component };
  });

  return (
    <Box sx={{ height: '100%', position: 'relative' }}>
      <ResizablePanels
        panels={updatedPanels}
        onPanelVisibilityChange={handlePanelVisibilityChange}
        onPanelReorder={handlePanelReorder}
      />

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
          Add Location
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
        }}
        timelineId={currentTimelineId}
        entityId={editingEntityId}
        onEntityCreated={() => {
          setEntityModalOpen(false);
          setEditingEntityId(null);
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
    </Box>
  );
}