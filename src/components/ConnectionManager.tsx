'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import ConnectionLine from './ConnectionLine';
import ConnectionModal from './ConnectionModal';

interface Connection {
  _id: string;
  type: 'event-entity' | 'event-event' | 'entity-entity';
  sourceId: string;
  targetId: string;
  relationshipType: string;
  tags: string[];
  description?: string;
  startArrow: 'none' | 'arrow';
  endArrow: 'none' | 'arrow';
}

interface ConnectionManagerProps {
  timelineId: string | null;
  showConnections: boolean;
  isConnecting: boolean;
  connectingSource: {
    type: 'event' | 'entity';
    id: string;
    name: string;
  } | null;
  onConnectionComplete: () => void;
  refreshTrigger: number;
  onConnectionTarget?: (targetType: 'event' | 'entity', targetId: string, targetName: string) => void;
}

interface ElementPosition {
  id: string;
  type: 'event' | 'entity';
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ConnectionManager({
  timelineId,
  showConnections,
  isConnecting,
  connectingSource,
  onConnectionComplete,
  refreshTrigger,
  onConnectionTarget,
}: ConnectionManagerProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [elementPositions, setElementPositions] = useState<Map<string, ElementPosition>>(new Map());
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceType: 'event' | 'entity';
    sourceId: string;
    sourceName: string;
    targetType: 'event' | 'entity';
    targetId: string;
    targetName: string;
  } | null>(null);
  const [snapTargetPosition, setSnapTargetPosition] = useState<{ x: number; y: number } | null>(null);

  // Fetch connections
  const fetchConnections = useCallback(async () => {
    if (!timelineId) return;

    try {
      const response = await fetch(`/api/connections?timelineId=${timelineId}`);
      if (response.ok) {
        const data = await response.json();
        setConnections(data);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  }, [timelineId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections, refreshTrigger]);

  // Update element positions
  const updateElementPositions = useCallback(() => {
    const newPositions = new Map<string, ElementPosition>();

    // Find all entity and event elements
    const entityElements = document.querySelectorAll('[data-entity-id]');
    const eventElements = document.querySelectorAll('[data-event-id]');

    entityElements.forEach((el) => {
      const id = el.getAttribute('data-entity-id');
      if (id) {
        const rect = el.getBoundingClientRect();
        newPositions.set(id, {
          id,
          type: 'entity',
          x: rect.left, // Center left edge connection point
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    eventElements.forEach((el) => {
      const id = el.getAttribute('data-event-id');
      if (id) {
        const rect = el.getBoundingClientRect();
        newPositions.set(id, {
          id,
          type: 'event',
          x: rect.right, // Center right edge connection point
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    setElementPositions(newPositions);
  }, []);

  // Update positions on scroll and resize
  useEffect(() => {
    updateElementPositions();

    const handleUpdate = () => updateElementPositions();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    const observer = new MutationObserver(handleUpdate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      observer.disconnect();
    };
  }, [updateElementPositions, refreshTrigger]);

  // Track mouse position when connecting (for visual line following cursor) - disabled
  useEffect(() => {
    if (!isConnecting) return;

    // Disabled mouse tracking since visual line is disabled to prevent click blocking
    // const handleMouseMove = (e: MouseEvent) => {
    //   setMousePosition({ x: e.clientX, y: e.clientY });
    // };

    // document.addEventListener('mousemove', handleMouseMove);

    // return () => {
    //   document.removeEventListener('mousemove', handleMouseMove);
    // };
  }, [isConnecting]);

  const handleCreateConnection = async (connectionData: {
    relationshipType: string;
    tags: string[];
    description?: string;
    startArrow: 'none' | 'arrow';
    endArrow: 'none' | 'arrow';
  }) => {
    if (!pendingConnection || !timelineId) return;

    try {
      const connectionType = `${pendingConnection.sourceType}-${pendingConnection.targetType}`;

      const payload = {
        type: connectionType,
        sourceId: pendingConnection.sourceId,
        targetId: pendingConnection.targetId,
        relationshipType: connectionData.relationshipType,
        tags: connectionData.tags,
        description: connectionData.description,
        startArrow: connectionData.startArrow,
        endArrow: connectionData.endArrow,
        timelineId,
      };

      console.log('Creating connection with payload:', payload);

      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchConnections();
        setConnectionModalOpen(false);
        setPendingConnection(null);
        setSnapTargetPosition(null);
        onConnectionComplete();
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Response doesn't contain valid JSON
        }
        console.error('Error creating connection:', errorMessage);
        alert(`Failed to create connection: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchConnections();
      } else {
        console.error('Failed to delete connection');
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  };

  const handleExternalConnectionTarget = useCallback((targetType: 'event' | 'entity', targetId: string, targetName: string) => {
    if (!connectingSource || !isConnecting) return;

    // Don't connect to self
    if (targetId === connectingSource.id) return;

    // Get target position for snapping
    const targetPosition = elementPositions.get(targetId);
    if (targetPosition) {
      setSnapTargetPosition({ x: targetPosition.x, y: targetPosition.y });
    }

    setPendingConnection({
      sourceType: connectingSource.type,
      sourceId: connectingSource.id,
      sourceName: connectingSource.name,
      targetType,
      targetId,
      targetName,
    });
    setConnectionModalOpen(true);
  }, [connectingSource, isConnecting, elementPositions]);

  // Handle external connection target calls directly through props
  const handleConnectionTargetCall = useCallback((targetType: 'event' | 'entity', targetId: string, targetName: string) => {
    handleExternalConnectionTarget(targetType, targetId, targetName);
  }, [handleExternalConnectionTarget]);

  // Expose handler to parent component for use
  useEffect(() => {
    (window as any).connectionManagerHandler = handleConnectionTargetCall;
    return () => {
      delete (window as any).connectionManagerHandler;
    };
  }, [handleConnectionTargetCall]);

  const getConnectionPoints = (connection: Connection) => {
    const sourcePos = elementPositions.get(connection.sourceId);
    const targetPos = elementPositions.get(connection.targetId);

    if (!sourcePos || !targetPos) return null;

    return {
      startX: sourcePos.x,
      startY: sourcePos.y,
      endX: targetPos.x,
      endY: targetPos.y,
    };
  };

  // Analyze connection routing to prevent overlapping lines
  const analyzeConnectionRouting = (connections: Connection[]) => {
    const routingGroups: Connection[][] = [];

    // Group connections that would visually overlap
    connections.forEach(connection => {
      const points = getConnectionPoints(connection);
      if (!points) return;

      const connectionVerticalRange = {
        min: Math.min(points.startY, points.endY) - 20, // 20px tolerance
        max: Math.max(points.startY, points.endY) + 20,
        startX: points.startX,
        endX: points.endX,
        connection
      };

      // Find existing group that this connection overlaps with
      let foundGroup = false;
      for (const group of routingGroups) {
        const groupOverlaps = group.some(groupConnection => {
          const groupPoints = getConnectionPoints(groupConnection);
          if (!groupPoints) return false;

          const groupVerticalRange = {
            min: Math.min(groupPoints.startY, groupPoints.endY) - 20,
            max: Math.max(groupPoints.startY, groupPoints.endY) + 20,
          };

          // Check for vertical overlap
          const verticalOverlap = connectionVerticalRange.min <= groupVerticalRange.max &&
                                 connectionVerticalRange.max >= groupVerticalRange.min;

          // Check for horizontal path intersection (both are on same side of timeline)
          const sameDirection = (connectionVerticalRange.startX < connectionVerticalRange.endX) ===
                               (groupPoints.startX < groupPoints.endX);

          return verticalOverlap && sameDirection;
        });

        if (groupOverlaps) {
          group.push(connection);
          foundGroup = true;
          break;
        }
      }

      // Create new group if no overlap found
      if (!foundGroup) {
        routingGroups.push([connection]);
      }
    });

    // Calculate offset index for each connection
    const connectionOffsets = new Map<string, number>();

    routingGroups.forEach((group) => {
      if (group.length <= 1) {
        // Single connection, no offset needed
        group.forEach(connection => {
          connectionOffsets.set(connection._id, 0);
        });
        return;
      }

      // Sort connections in group for consistent ordering
      group.sort((a, b) => {
        const aPoints = getConnectionPoints(a);
        const bPoints = getConnectionPoints(b);
        if (!aPoints || !bPoints) return 0;

        // Primary sort: vertical start position
        if (Math.abs(aPoints.startY - bPoints.startY) > 10) {
          return aPoints.startY - bPoints.startY;
        }
        // Secondary sort: horizontal start position
        return aPoints.startX - bPoints.startX;
      });

      // Assign offset indices with center-balanced distribution
      group.forEach((connection, index) => {
        const totalConnections = group.length;
        const centerOffset = Math.floor(totalConnections / 2);
        const balancedIndex = index - centerOffset;
        connectionOffsets.set(connection._id, balancedIndex);
      });
    });

    return connectionOffsets;
  };

  if (!showConnections && !isConnecting) return null;

  // Calculate routing offsets for non-overlapping lines
  const connectionOffsets = showConnections ? analyzeConnectionRouting(connections) : new Map();

  return (
    <>
      {/* Single overlay for all connection lines - no click blocking */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none', // Critical: no click blocking
          zIndex: 0, // Lower than timeline content
        }}
      >
        {/* Existing connections */}
        {showConnections &&
          connections.map((connection) => {
            const points = getConnectionPoints(connection);
            if (!points) return null;

            const offsetIndex = connectionOffsets.get(connection._id) || 0;

            // Extract names from populated sourceId and targetId
            // Handle different possible data structures
            let sourceName = 'Unknown Source';
            let targetName = 'Unknown Target';

            if (connection.sourceId) {
              if (typeof connection.sourceId === 'object') {
                sourceName = (connection.sourceId as any).name || (connection.sourceId as any).title || 'Unknown Source';
              } else {
                sourceName = 'Unpopulated Source';
              }
            }

            if (connection.targetId) {
              if (typeof connection.targetId === 'object') {
                targetName = (connection.targetId as any).name || (connection.targetId as any).title || 'Unknown Target';
              } else {
                targetName = 'Unpopulated Target';
              }
            }

            return (
              <ConnectionLine
                key={connection._id}
                connectionId={connection._id}
                startX={points.startX}
                startY={points.startY}
                endX={points.endX}
                endY={points.endY}
                relationshipType={connection.relationshipType}
                startArrow={connection.startArrow}
                endArrow={connection.endArrow}
                tags={connection.tags}
                description={connection.description}
                sourceType={connection.type.startsWith('entity') ? 'entity' : 'event'}
                sourceName={sourceName}
                targetName={targetName}
                offsetIndex={offsetIndex}
                onDelete={handleDeleteConnection}
              />
            );
          })}

        {/* Active connection being created - disabled to prevent click blocking */}
        {false && isConnecting && connectingSource && (
          (() => {
            const sourcePos = elementPositions.get(connectingSource.id);
            if (!sourcePos) return null;

            // Use snap position if available, otherwise use mouse position
            const endPos = snapTargetPosition || mousePosition;

            return (
              <ConnectionLine
                startX={sourcePos.x}
                startY={sourcePos.y}
                endX={endPos.x}
                endY={endPos.y}
                relationshipType="connecting"
                startArrow="none"
                endArrow="none"
                isDragging={true}
                sourceType={connectingSource.type}
              />
            );
          })()
        )}
      </Box>

      {/* Connection Modal */}
      {pendingConnection && (
        <ConnectionModal
          open={connectionModalOpen}
          onClose={() => {
            setConnectionModalOpen(false);
            setPendingConnection(null);
            setSnapTargetPosition(null);
            onConnectionComplete();
          }}
          sourceType={pendingConnection.sourceType}
          sourceName={pendingConnection.sourceName}
          targetType={pendingConnection.targetType}
          targetName={pendingConnection.targetName}
          onSave={handleCreateConnection}
        />
      )}
    </>
  );
}