'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Autocomplete,
  TextField,
  Card,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';

interface Event {
  _id: string;
  title: string;
  startDateTime: string;
}

interface Entity {
  _id: string;
  name: string;
  type: string;
}

interface Connection {
  _id: string;
  type: 'event-entity' | 'event-event' | 'entity-entity';
  sourceId: any;
  targetId: any;
  relationshipType: string;
  tags: string[];
  description?: string;
  startArrow: 'none' | 'arrow';
  endArrow: 'none' | 'arrow';
}

interface ConnectionManagerModalProps {
  open: boolean;
  onClose: () => void;
  timelineId: string | null;
}

const getEntityTypeColor = (type: string) => {
  switch (type) {
    case 'person':
      return '#1976d2'; // primary blue
    case 'organization':
      return '#9c27b0'; // secondary purple
    case 'place':
      return '#2e7d32'; // success green
    case 'object':
      return '#ed6c02'; // warning orange
    case 'concept':
      return '#0288d1'; // info blue
    default:
      return '#757575'; // default grey
  }
};

export default function ConnectionManagerModal({
  open,
  onClose,
  timelineId,
}: ConnectionManagerModalProps) {
  const [sourceType, setSourceType] = useState<'event' | 'entity'>('event');
  const [targetType, setTargetType] = useState<'event' | 'entity'>('event');
  const [sourceItem, setSourceItem] = useState<Event | Entity | null>(null);
  const [targetItem, setTargetItem] = useState<Event | Entity | null>(null);
  const [relationship, setRelationship] = useState('');

  const [events, setEvents] = useState<Event[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [creating, setCreating] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [startArrow, setStartArrow] = useState<'none' | 'arrow'>('none');
  const [endArrow, setEndArrow] = useState<'none' | 'arrow'>('none');
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSourceItem(null);
      setTargetItem(null);
      setRelationship('');
      setTags([]);
      setDescription('');
      setStartArrow('none');
      setEndArrow('none');
      setEditingConnectionId(null);
    }
  }, [open]);

  // Fetch events and entities
  useEffect(() => {
    if (!timelineId || !open) return;

    const fetchData = async () => {
      try {
        const [eventsRes, entitiesRes] = await Promise.all([
          fetch(`/api/events?timelineId=${timelineId}`),
          fetch(`/api/entities?timelineId=${timelineId}`),
        ]);

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData);
        }

        if (entitiesRes.ok) {
          const entitiesData = await entitiesRes.json();
          setEntities(entitiesData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [timelineId, open]);

  // Fetch connections when source or target item is selected
  useEffect(() => {
    if (!timelineId || !open) return;

    const selectedItem = sourceItem || targetItem;
    if (!selectedItem) {
      setConnections([]);
      return;
    }

    const fetchConnections = async () => {
      try {
        const response = await fetch(`/api/connections?timelineId=${timelineId}`);
        if (response.ok) {
          const allConnections = await response.json();

          // Filter connections involving the selected item
          const relevantConnections = allConnections.filter((conn: Connection) => {
            if (!conn.sourceId || !conn.targetId) return false; // Skip connections with null references
            const sourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
            const targetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;
            return sourceId === selectedItem._id || targetId === selectedItem._id;
          });

          setConnections(relevantConnections);
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
      }
    };

    fetchConnections();
  }, [timelineId, open, sourceItem, targetItem]);

  const relationshipTypes = [
    'related to',
    'caused',
    'influenced',
    'led to',
    'resulted from',
    'associated with',
    'part of',
    'member of',
    'located at',
    'occurred at',
    'participated in',
    'owns',
    'created',
    'founded',
  ];

  const getSourceOptions = () => {
    return sourceType === 'event' ? events : entities;
  };

  const getTargetOptions = () => {
    return targetType === 'event' ? events : entities;
  };

  const getItemLabel = (item: Event | Entity) => {
    if ('title' in item) {
      return item.title;
    }
    return item.name;
  };

  const getItemName = (item: any) => {
    if (!item) return 'Unknown';
    if (typeof item === 'string') {
      // If it's just an ID string, try to look it up in our events/entities
      const foundEvent = events.find(e => e._id === item);
      if (foundEvent) return foundEvent.title;

      const foundEntity = entities.find(e => e._id === item);
      if (foundEntity) return foundEntity.name;

      return 'Unknown Item';
    }
    return item.title || item.name || 'Unknown';
  };

  const getItemType = (item: any) => {
    if (!item) return 'event';
    if (typeof item === 'string') {
      // If it's just an ID string, try to look it up
      const foundEvent = events.find(e => e._id === item);
      if (foundEvent) return 'event';

      const foundEntity = entities.find(e => e._id === item);
      if (foundEntity) return foundEntity.type;

      return 'event';
    }
    return item.type || 'event';
  };

  const getItemBorderColor = (item: any) => {
    const type = getItemType(item);
    if (type === 'event' || !type) return '#1976d2'; // default blue for events
    return getEntityTypeColor(type);
  };

  // Create or update connection handler
  const handleCreateConnection = async () => {
    if (!sourceItem || !targetItem || !relationship || !timelineId) return;

    setCreating(true);
    const isUpdating = !!editingConnectionId;

    try {
      // Normalize connection type - if one is event, event should come first
      // Valid types: event-entity, event-event, entity-entity
      let normalizedType: string;
      let normalizedSourceId: string;
      let normalizedTargetId: string;
      let normalizedSourceModel: 'Event' | 'Entity';
      let normalizedTargetModel: 'Event' | 'Entity';

      if (sourceType === 'event' && targetType === 'entity') {
        // event-entity (already correct)
        normalizedType = 'event-entity';
        normalizedSourceId = sourceItem._id;
        normalizedTargetId = targetItem._id;
        normalizedSourceModel = 'Event';
        normalizedTargetModel = 'Entity';
      } else if (sourceType === 'entity' && targetType === 'event') {
        // entity-event -> swap to event-entity
        normalizedType = 'event-entity';
        normalizedSourceId = targetItem._id; // swap
        normalizedTargetId = sourceItem._id; // swap
        normalizedSourceModel = 'Event'; // swap
        normalizedTargetModel = 'Entity'; // swap
      } else if (sourceType === 'event' && targetType === 'event') {
        normalizedType = 'event-event';
        normalizedSourceId = sourceItem._id;
        normalizedTargetId = targetItem._id;
        normalizedSourceModel = 'Event';
        normalizedTargetModel = 'Event';
      } else {
        // entity-entity
        normalizedType = 'entity-entity';
        normalizedSourceId = sourceItem._id;
        normalizedTargetId = targetItem._id;
        normalizedSourceModel = 'Entity';
        normalizedTargetModel = 'Entity';
      }

      const payload = {
        type: normalizedType,
        sourceId: normalizedSourceId,
        targetId: normalizedTargetId,
        sourceModel: normalizedSourceModel,
        targetModel: normalizedTargetModel,
        relationshipType: relationship,
        tags: tags,
        description: description,
        startArrow: startArrow,
        endArrow: endArrow,
        timelineId,
      };

      console.log(isUpdating ? 'Updating connection with payload:' : 'Creating connection with payload:', payload);

      const url = isUpdating ? `/api/connections/${editingConnectionId}` : '/api/connections';
      const method = isUpdating ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log(`Connection ${isUpdating ? 'update' : 'creation'} response:`, response.status, response.statusText);

      if (response.ok) {
        // Refresh connections
        const selectedItem = sourceItem || targetItem;
        if (selectedItem) {
          const connectionsResponse = await fetch(`/api/connections?timelineId=${timelineId}`);
          if (connectionsResponse.ok) {
            const allConnections = await connectionsResponse.json();
            const relevantConnections = allConnections.filter((conn: Connection) => {
              if (!conn.sourceId || !conn.targetId) return false;
              const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
              const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;
              return connSourceId === selectedItem._id || connTargetId === selectedItem._id;
            });
            setConnections(relevantConnections);
          }
        }

        // Clear form
        setRelationship('');
        setTags([]);
        setDescription('');
        setStartArrow('none');
        setEndArrow('none');
        setEditingConnectionId(null);
      } else {
        // Try to get error details
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorText = await response.text();
          console.error('Error response text:', errorText);

          // Try to parse as JSON
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // Not JSON, use text as is
            if (errorText) {
              errorMessage = errorText;
            }
          }
        } catch (e) {
          console.error('Could not read error response:', e);
        }

        console.error('Failed to create connection:', errorMessage);
        alert(`Failed to create connection: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error creating connection:', error);
      alert('Failed to create connection');
    } finally {
      setCreating(false);
    }
  };

  // Delete connection handler
  const handleDeleteConnection = async () => {
    if (!editingConnectionId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/connections/${editingConnectionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh connections
        const selectedItem = sourceItem || targetItem;
        if (selectedItem && timelineId) {
          const connectionsResponse = await fetch(`/api/connections?timelineId=${timelineId}`);
          if (connectionsResponse.ok) {
            const allConnections = await connectionsResponse.json();
            const relevantConnections = allConnections.filter((conn: Connection) => {
              if (!conn.sourceId || !conn.targetId) return false;
              const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
              const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;
              return connSourceId === selectedItem._id || connTargetId === selectedItem._id;
            });
            setConnections(relevantConnections);
          }
        }

        // Clear form and close dialog
        setSourceItem(null);
        setTargetItem(null);
        setRelationship('');
        setTags([]);
        setDescription('');
        setStartArrow('none');
        setEndArrow('none');
        setEditingConnectionId(null);
        setDeleteConfirmOpen(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to delete connection:', errorData);
        alert(`Failed to delete connection: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Failed to delete connection');
    } finally {
      setDeleting(false);
    }
  };

  // Check if current source/target pair already has a connection
  const hasExistingConnection = () => {
    if (!sourceItem || !targetItem) return false;

    return connections.some((conn) => {
      if (!conn.sourceId || !conn.targetId) return false;
      const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
      const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;

      return (
        (connSourceId === sourceItem._id && connTargetId === targetItem._id) ||
        (connSourceId === targetItem._id && connTargetId === sourceItem._id)
      );
    });
  };

  // Handle clicking on an existing connection to load it
  const handleConnectionClick = (connection: Connection) => {
    if (!connection.sourceId || !connection.targetId) return; // Skip invalid connections
    const connSourceId = typeof connection.sourceId === 'object' ? connection.sourceId._id : connection.sourceId;
    const connTargetId = typeof connection.targetId === 'object' ? connection.targetId._id : connection.targetId;

    // Find the source and target items
    const sourceEntity = entities.find(e => e._id === connSourceId);
    const sourceEvent = events.find(e => e._id === connSourceId);
    const source = sourceEntity || sourceEvent;

    const targetEntity = entities.find(e => e._id === connTargetId);
    const targetEvent = events.find(e => e._id === connTargetId);
    const target = targetEntity || targetEvent;

    if (source && target) {
      // Determine types
      const sType = sourceEntity ? 'entity' : 'event';
      const tType = targetEntity ? 'entity' : 'event';

      // Set the form values
      setSourceType(sType);
      setTargetType(tType);
      setSourceItem(source);
      setTargetItem(target);
      setRelationship(connection.relationshipType);
      setTags(connection.tags || []);
      setDescription(connection.description || '');
      setStartArrow(connection.startArrow);
      setEndArrow(connection.endArrow);
      setEditingConnectionId(connection._id);
    }
  };

  // Render connection visualization
  const renderConnectionGraph = () => {
    const selectedItem = sourceItem || targetItem;

    // Show preview if both source and target are selected
    const showPreview = sourceItem && targetItem && sourceItem._id !== targetItem._id;
    const existingConnection = hasExistingConnection();

    if (!selectedItem && !showPreview) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            Select an entity or event to view connections
          </Typography>
        </Box>
      );
    }

    if (selectedItem && connections.length === 0 && !showPreview) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            No connections found
          </Typography>
        </Box>
      );
    }

    // Build graph structure
    interface GraphNode {
      id: string;
      item: any;
      isSource: boolean;
      yOffset: number;
    }

    // Determine the actual source node (prefer sourceItem if both selected)
    const actualSourceItem = showPreview ? sourceItem! : selectedItem!;

    const sourceNode: GraphNode = {
      id: actualSourceItem._id,
      item: actualSourceItem,
      isSource: true,
      yOffset: 0,
    };

    const connectedNodes: GraphNode[] = [];

    // Add connections from existing data
    connections.forEach((conn, index) => {
      if (!conn.sourceId || !conn.targetId) return; // Skip invalid connections
      const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
      const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;

      // Determine which item is the connected one
      let connectedItem;
      if (connSourceId === actualSourceItem._id) {
        connectedItem = conn.targetId;
      } else {
        connectedItem = conn.sourceId;
      }

      if (!connectedItem) return; // Skip if connected item is null

      const connectedId = typeof connectedItem === 'object' ? connectedItem._id : connectedItem;

      // Check if already added
      if (!connectedNodes.some(n => n.id === connectedId)) {
        connectedNodes.push({
          id: connectedId,
          item: connectedItem,
          isSource: false,
          yOffset: index,
        });
      }
    });

    // Add target item as a preview node if both are selected and not already connected
    if (showPreview && targetItem && !connectedNodes.some(n => n.id === targetItem._id)) {
      connectedNodes.push({
        id: targetItem._id,
        item: targetItem,
        isSource: false,
        yOffset: connectedNodes.length,
      });
    }

    const nodeMinHeight = 60;
    const nodeSpacing = 100; // Increased spacing to accommodate taller cards
    const leftX = 40;
    const rightX = 300;
    const lineColor = '#666';
    const svgHeight = Math.max(400, (connectedNodes.length + 1) * nodeSpacing + 100);

    return (
      <Box sx={{ position: 'relative', minHeight: svgHeight, overflow: 'auto', p: 2 }}>
        <svg
          width="100%"
          height={svgHeight}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Define arrowhead markers for connection diagram */}
          <defs>
            {/* Start arrow - points right (away from center) */}
            <marker
              id="arrowhead-start-diagram"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="0"
              viewBox="0 0 10 10"
            >
              <polygon points="0 5, 10 0, 10 10" fill="#666" />
            </marker>
            {/* End arrow - points left (away from center) */}
            <marker
              id="arrowhead-end-diagram"
              markerWidth="10"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="180"
              viewBox="0 0 10 10"
            >
              <polygon points="0 5, 10 0, 10 10" fill="#666" />
            </marker>
            {/* Highlighted start arrow */}
            <marker
              id="arrowhead-start-highlight"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="0"
              viewBox="0 0 10 10"
            >
              <polygon points="0 5, 10 0, 10 10" fill="#1976d2" />
            </marker>
            {/* Highlighted end arrow */}
            <marker
              id="arrowhead-end-highlight"
              markerWidth="10"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="180"
              viewBox="0 0 10 10"
            >
              <polygon points="0 5, 10 0, 10 10" fill="#1976d2" />
            </marker>
            {/* Orange start arrow for selected */}
            <marker
              id="arrowhead-start-orange"
              markerWidth="10"
              markerHeight="10"
              refX="10"
              refY="5"
              orient="0"
              viewBox="0 0 10 10"
            >
              <polygon points="0 5, 10 0, 10 10" fill="#ffa726" />
            </marker>
            {/* Orange end arrow for selected */}
            <marker
              id="arrowhead-end-orange"
              markerWidth="10"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="180"
              viewBox="0 0 10 10"
            >
              <polygon points="0 5, 10 0, 10 10" fill="#ffa726" />
            </marker>
          </defs>

          {/* LAYER 1: Draw all connection lines first (behind everything) */}
          <g id="lines-layer">
            {connections.map((conn, index) => {
              if (!conn.sourceId || !conn.targetId) return null;
              const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
              const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;

              // Find connected node index
              let connectedItem;
              if (connSourceId === actualSourceItem._id) {
                connectedItem = conn.targetId;
              } else {
                connectedItem = conn.sourceId;
              }
              if (!connectedItem) return null;
              const connectedId = typeof connectedItem === 'object' ? connectedItem._id : connectedItem;
              const connectedNodeIndex = connectedNodes.findIndex(n => n.id === connectedId);

              if (connectedNodeIndex === -1) return null;

              // Check if this connection matches the selected source/target pair
              const isHighlighted = showPreview && targetItem && (
                (connSourceId === sourceItem!._id && connTargetId === targetItem._id) ||
                (connSourceId === targetItem._id && connTargetId === sourceItem!._id)
              );

              const isHovered = hoveredConnectionId === conn._id;

              const startY = 100 + nodeMinHeight / 2;
              const endY = 100 + connectedNodeIndex * nodeSpacing + nodeMinHeight / 2;
              const midX = (leftX + 120 + rightX) / 2;

              // Calculate path with 90-degree turns, add vertical offset based on index to prevent overlap
              const verticalOffset = (index % 3) * 15; // Spread lines vertically
              const path = `
                M ${leftX + 120} ${startY}
                L ${midX - verticalOffset} ${startY}
                L ${midX - verticalOffset} ${endY}
                L ${rightX} ${endY}
              `;

              // Determine which marker set to use based on state
              const markerSuffix = isHighlighted ? 'orange' : isHovered ? 'highlight' : 'diagram';

              return (
                <path
                  key={`line-${conn._id}`}
                  d={path}
                  stroke={isHighlighted ? '#ffa726' : isHovered ? '#1976d2' : lineColor}
                  strokeWidth={isHighlighted || isHovered ? '4' : '2'}
                  fill="none"
                  style={{ cursor: 'pointer' }}
                  markerStart={conn.startArrow === 'arrow' ? `url(#arrowhead-start-${markerSuffix})` : undefined}
                  markerEnd={conn.endArrow === 'arrow' ? `url(#arrowhead-end-${markerSuffix})` : undefined}
                  onMouseEnter={() => setHoveredConnectionId(conn._id)}
                  onMouseLeave={() => setHoveredConnectionId(null)}
                  onClick={() => handleConnectionClick(conn)}
                />
              );
            })}

            {/* Draw preview connection line if both source and target selected but not connected */}
            {showPreview && !existingConnection && targetItem && (
              (() => {
                const targetNodeIndex = connectedNodes.findIndex(n => n.id === targetItem._id);
                if (targetNodeIndex === -1) return null;

                const startY = 100 + nodeMinHeight / 2;
                const endY = 100 + targetNodeIndex * nodeSpacing + nodeMinHeight / 2;
                const midX = (leftX + 120 + rightX) / 2;
                const verticalOffset = 0;

                const path = `
                  M ${leftX + 120} ${startY}
                  L ${midX - verticalOffset} ${startY}
                  L ${midX - verticalOffset} ${endY}
                  L ${rightX} ${endY}
                `;

                return (
                  <path
                    key="preview-line"
                    d={path}
                    stroke="#4caf50"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="5,5"
                    markerStart={startArrow === 'arrow' ? `url(#arrowhead-start-diagram)` : undefined}
                    markerEnd={endArrow === 'arrow' ? `url(#arrowhead-end-diagram)` : undefined}
                  />
                );
              })()
            )}
          </g>

          {/* LAYER 2: Draw white backgrounds for chips */}
          <g id="backgrounds-layer">
            {connections.map((conn, index) => {
              if (!conn.sourceId || !conn.targetId) return null;
              const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
              const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;

              let connectedItem;
              if (connSourceId === actualSourceItem._id) {
                connectedItem = conn.targetId;
              } else {
                connectedItem = conn.sourceId;
              }
              if (!connectedItem) return null;
              const connectedId = typeof connectedItem === 'object' ? connectedItem._id : connectedItem;
              const connectedNodeIndex = connectedNodes.findIndex(n => n.id === connectedId);

              if (connectedNodeIndex === -1) return null;

              const startY = 100 + nodeMinHeight / 2;
              const endY = 100 + connectedNodeIndex * nodeSpacing + nodeMinHeight / 2;
              const midX = (leftX + 120 + rightX) / 2;
              const verticalOffset = (index % 3) * 15;
              const midPointX = midX - verticalOffset;
              const midPointY = (startY + endY) / 2;

              return (
                <rect
                  key={`bg-${conn._id}`}
                  x={midPointX - 52}
                  y={midPointY - 14}
                  width="104"
                  height="28"
                  fill="white"
                  stroke="none"
                />
              );
            })}

            {/* Preview background */}
            {showPreview && !existingConnection && targetItem && relationship && (
              (() => {
                const targetNodeIndex = connectedNodes.findIndex(n => n.id === targetItem._id);
                if (targetNodeIndex === -1) return null;

                const startY = 100 + nodeMinHeight / 2;
                const endY = 100 + targetNodeIndex * nodeSpacing + nodeMinHeight / 2;
                const midX = (leftX + 120 + rightX) / 2;
                const verticalOffset = 0;
                const midPointX = midX - verticalOffset;
                const midPointY = (startY + endY) / 2;

                return (
                  <rect
                    key="preview-bg"
                    x={midPointX - 52}
                    y={midPointY - 14}
                    width="104"
                    height="28"
                    fill="white"
                    stroke="none"
                  />
                );
              })()
            )}
          </g>

          {/* LAYER 3: Draw chips on top */}
          <g id="chips-layer">
            {connections.map((conn, index) => {
              if (!conn.sourceId || !conn.targetId) return null;
              const connSourceId = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
              const connTargetId = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;

              let connectedItem;
              if (connSourceId === actualSourceItem._id) {
                connectedItem = conn.targetId;
              } else {
                connectedItem = conn.sourceId;
              }
              if (!connectedItem) return null;
              const connectedId = typeof connectedItem === 'object' ? connectedItem._id : connectedItem;
              const connectedNodeIndex = connectedNodes.findIndex(n => n.id === connectedId);

              if (connectedNodeIndex === -1) return null;

              const isHighlighted = showPreview && targetItem && (
                (connSourceId === sourceItem!._id && connTargetId === targetItem._id) ||
                (connSourceId === targetItem._id && connTargetId === sourceItem!._id)
              );

              const isHovered = hoveredConnectionId === conn._id;

              const startY = 100 + nodeMinHeight / 2;
              const endY = 100 + connectedNodeIndex * nodeSpacing + nodeMinHeight / 2;
              const midX = (leftX + 120 + rightX) / 2;
              const verticalOffset = (index % 3) * 15;
              const midPointX = midX - verticalOffset;
              const midPointY = (startY + endY) / 2;

              return (
                <foreignObject
                  key={`chip-${conn._id}`}
                  x={midPointX - 50}
                  y={midPointY - 12}
                  width="100"
                  height="24"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredConnectionId(conn._id)}
                  onMouseLeave={() => setHoveredConnectionId(null)}
                  onClick={() => handleConnectionClick(conn)}
                >
                  <Chip
                    label={conn.relationshipType}
                    size="small"
                    sx={{
                      backgroundColor: isHighlighted ? '#ffa726' : isHovered ? '#1976d2' : lineColor,
                      color: 'white',
                      fontSize: '0.7rem',
                      height: '20px',
                      cursor: 'pointer',
                    }}
                  />
                </foreignObject>
              );
            })}

            {/* Preview chip */}
            {showPreview && !existingConnection && targetItem && relationship && (
              (() => {
                const targetNodeIndex = connectedNodes.findIndex(n => n.id === targetItem._id);
                if (targetNodeIndex === -1) return null;

                const startY = 100 + nodeMinHeight / 2;
                const endY = 100 + targetNodeIndex * nodeSpacing + nodeMinHeight / 2;
                const midX = (leftX + 120 + rightX) / 2;
                const verticalOffset = 0;
                const midPointX = midX - verticalOffset;
                const midPointY = (startY + endY) / 2;

                return (
                  <foreignObject
                    key="preview-chip"
                    x={midPointX - 50}
                    y={midPointY - 12}
                    width="100"
                    height="24"
                  >
                    <Chip
                      label={relationship}
                      size="small"
                      sx={{
                        backgroundColor: '#4caf50',
                        color: 'white',
                        fontSize: '0.7rem',
                        height: '20px',
                      }}
                    />
                  </foreignObject>
                );
              })()
            )}
          </g>
        </svg>

        {/* Source node */}
        <Card
          sx={{
            position: 'absolute',
            left: leftX,
            top: 100,
            width: 120,
            minHeight: nodeMinHeight,
            border: '3px solid',
            borderColor: getItemBorderColor(actualSourceItem),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1,
            pointerEvents: 'auto',
            zIndex: 10,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 'bold',
              textAlign: 'center',
              fontSize: '0.8rem',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
            }}
          >
            {getItemName(actualSourceItem)}
          </Typography>
        </Card>

        {/* Connected nodes */}
        {connectedNodes.map((node, index) => {
          // Highlight if this is the selected target
          const isSelectedTarget = showPreview && targetItem && node.id === targetItem._id;

          return (
            <Card
              key={node.id}
              sx={{
                position: 'absolute',
                left: rightX,
                top: 100 + index * nodeSpacing,
                width: 120,
                minHeight: nodeMinHeight,
                border: '3px solid',
                borderColor: isSelectedTarget && !existingConnection ? '#4caf50' :
                             isSelectedTarget && existingConnection ? '#ffa726' :
                             getItemBorderColor(node.item),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
                boxShadow: isSelectedTarget ? 4 : 1,
                pointerEvents: 'auto',
                zIndex: 10,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  hyphens: 'auto',
                }}
              >
                {getItemName(node.item)}
              </Typography>
            </Card>
          );
        })}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>Connection Manager</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', height: '100%', gap: 2, mt: 1 }}>
          {/* Left Column (60%) */}
          <Box sx={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Top Panel */}
            <Box sx={{
              flex: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              display: 'flex',
              gap: 2,
            }}>
              {/* Left Column - Source */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Source
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={sourceType}
                    label="Type"
                    onChange={(e) => {
                      setSourceType(e.target.value as 'event' | 'entity');
                      setSourceItem(null);
                    }}
                  >
                    <MenuItem value="event">Event</MenuItem>
                    <MenuItem value="entity">Entity</MenuItem>
                  </Select>
                </FormControl>
                <Autocomplete
                  value={sourceItem}
                  onChange={(_, newValue) => setSourceItem(newValue)}
                  options={getSourceOptions()}
                  getOptionLabel={getItemLabel}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                      <li key={option._id} {...otherProps}>
                        {getItemLabel(option)}
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={sourceType === 'event' ? 'Select Event' : 'Select Entity'}
                      size="small"
                    />
                  )}
                />
              </Box>

              {/* Middle Column - Relationship */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 200,
              }}>
                <Autocomplete
                  value={relationship}
                  onChange={(_, newValue) => setRelationship(newValue || '')}
                  onInputChange={(_, newInputValue) => setRelationship(newInputValue)}
                  options={relationshipTypes}
                  freeSolo
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="connects to..."
                      size="small"
                      sx={{ width: 200 }}
                    />
                  )}
                />
              </Box>

              {/* Right Column - Target */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Target
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={targetType}
                    label="Type"
                    onChange={(e) => {
                      setTargetType(e.target.value as 'event' | 'entity');
                      setTargetItem(null);
                    }}
                  >
                    <MenuItem value="event">Event</MenuItem>
                    <MenuItem value="entity">Entity</MenuItem>
                  </Select>
                </FormControl>
                <Autocomplete
                  value={targetItem}
                  onChange={(_, newValue) => setTargetItem(newValue)}
                  options={getTargetOptions()}
                  getOptionLabel={getItemLabel}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  renderOption={(props, option) => {
                    const { key, ...otherProps } = props;
                    return (
                      <li key={option._id} {...otherProps}>
                        {getItemLabel(option)}
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={targetType === 'event' ? 'Select Event' : 'Select Entity'}
                      size="small"
                    />
                  )}
                />
              </Box>
            </Box>

            {/* Bottom Panel - Additional Connection Details */}
            <Box sx={{
              flex: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Connection Details</Typography>

              {/* Description */}
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={3}
                size="small"
                fullWidth
                placeholder="Optional description of this connection..."
              />

              {/* Tags */}
              <Autocomplete
                multiple
                freeSolo
                value={tags}
                onChange={(_, newValue) => setTags(newValue)}
                options={[]}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    size="small"
                    placeholder="Add tags..."
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option}
                        size="small"
                        {...chipProps}
                      />
                    );
                  })
                }
              />

              {/* Arrow Controls */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Start Arrow</InputLabel>
                  <Select
                    value={startArrow}
                    label="Start Arrow"
                    onChange={(e) => setStartArrow(e.target.value as 'none' | 'arrow')}
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="arrow">Arrow</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>End Arrow</InputLabel>
                  <Select
                    value={endArrow}
                    label="End Arrow"
                    onChange={(e) => setEndArrow(e.target.value as 'none' | 'arrow')}
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="arrow">Arrow</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Connection Preview */}
              <Box sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                backgroundColor: 'grey.50',
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Preview
                </Typography>
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="300" height="60" viewBox="0 0 300 60" preserveAspectRatio="xMidYMid meet">
                    {/* Define arrowhead markers */}
                    <defs>
                      {/* Start arrow - points right (away from center) */}
                      <marker
                        id="arrowhead-start-preview"
                        markerWidth="10"
                        markerHeight="10"
                        refX="10"
                        refY="5"
                        orient="0"
                        viewBox="0 0 10 10"
                      >
                        <polygon points="0 5, 10 0, 10 10" fill="#666" />
                      </marker>
                      {/* End arrow - points left (away from center) */}
                      <marker
                        id="arrowhead-end-preview"
                        markerWidth="10"
                        markerHeight="10"
                        refX="0"
                        refY="5"
                        orient="180"
                        viewBox="0 0 10 10"
                      >
                        <polygon points="0 5, 10 0, 10 10" fill="#666" />
                      </marker>
                    </defs>

                    {/* Source endpoint */}
                    <circle cx="30" cy="30" r="8" fill="#1976d2" stroke="#fff" strokeWidth="2" />
                    <text x="30" y="50" textAnchor="middle" fontSize="10" fill="#666">Source</text>

                    {/* Connection line */}
                    <line
                      x1="38"
                      y1="30"
                      x2="262"
                      y2="30"
                      stroke="#666"
                      strokeWidth="2"
                      markerStart={startArrow === 'arrow' ? 'url(#arrowhead-start-preview)' : undefined}
                      markerEnd={endArrow === 'arrow' ? 'url(#arrowhead-end-preview)' : undefined}
                    />

                    {/* Target endpoint */}
                    <circle cx="270" cy="30" r="8" fill="#1976d2" stroke="#fff" strokeWidth="2" />
                    <text x="270" y="50" textAnchor="middle" fontSize="10" fill="#666">Target</text>
                  </svg>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Right Column (40%) */}
          <Box sx={{
            flex: '0 0 40%',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0, // Allow flex child to shrink
          }}>
            <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>Existing Connections</Typography>
            <Box sx={{
              flex: 1,
              overflow: 'auto',
              position: 'relative',
              minHeight: 0, // Allow flex child to shrink
            }}>
              {renderConnectionGraph()}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            color="error"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={!editingConnectionId || deleting || creating}
          >
            Delete
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={creating || deleting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateConnection}
              disabled={!sourceItem || !targetItem || !relationship || creating || deleting || (!editingConnectionId && hasExistingConnection())}
              startIcon={creating ? <CircularProgress size={16} /> : undefined}
            >
              {creating ? (editingConnectionId ? 'Updating...' : 'Creating...') : (editingConnectionId ? 'Update Connection' : 'Create Connection')}
            </Button>
          </Box>
        </Box>
      </DialogActions>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Delete Connection
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this connection?
            {sourceItem && targetItem && (
              <>
                <br /><br />
                <strong>{getItemName(sourceItem)}</strong> {relationship} <strong>{getItemName(targetItem)}</strong>
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConnection}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}
          >
            {deleting ? 'Deleting...' : 'Delete Connection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
