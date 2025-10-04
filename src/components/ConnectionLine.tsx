'use client';

import React from 'react';
import { useTheme } from '@mui/material/styles';
import { IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { Delete } from '@mui/icons-material';

interface ConnectionLineProps {
  connectionId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  relationshipType: string;
  startArrow: 'none' | 'arrow';
  endArrow: 'none' | 'arrow';
  isSelected?: boolean;
  isDragging?: boolean;
  tags?: string[];
  description?: string;
  sourceType?: 'entity' | 'event';
  sourceName?: string;
  targetName?: string;
  offsetIndex?: number; // For routing multiple lines side by side
  onDelete?: (connectionId: string) => void;
}

// Relationship type to color mapping (compatible with light/dark modes)
const getRelationshipColor = (relationshipType: string, isDark: boolean): string => {
  const colorMap: Record<string, { light: string; dark: string }> = {
    // Family relationships - warm colors
    familial: { light: '#E91E63', dark: '#F48FB1' },
    parent: { light: '#E91E63', dark: '#F48FB1' },
    child: { light: '#E91E63', dark: '#F48FB1' },
    sibling: { light: '#AD1457', dark: '#F8BBD9' },
    spouse: { light: '#880E4F', dark: '#FCE4EC' },
    relative: { light: '#C2185B', dark: '#F48FB1' },

    // Professional relationships - blues
    employment: { light: '#1976D2', dark: '#64B5F6' },
    employer: { light: '#0D47A1', dark: '#90CAF9' },
    employee: { light: '#1565C0', dark: '#64B5F6' },
    colleague: { light: '#1E88E5', dark: '#42A5F5' },
    business_partner: { light: '#1976D2', dark: '#64B5F6' },
    client: { light: '#2196F3', dark: '#42A5F5' },
    consultant: { light: '#0288D1', dark: '#29B6F6' },

    // Social relationships - greens
    friend: { light: '#388E3C', dark: '#81C784' },
    acquaintance: { light: '#689F38', dark: '#AED581' },
    mentor: { light: '#2E7D32', dark: '#A5D6A7' },
    student: { light: '#43A047', dark: '#81C784' },
    neighbor: { light: '#66BB6A', dark: '#A5D6A7' },

    // Organizational relationships - purples
    member: { light: '#7B1FA2', dark: '#BA68C8' },
    leader: { light: '#6A1B9A', dark: '#CE93D8' },
    founder: { light: '#4A148C', dark: '#E1BEE7' },
    board_member: { light: '#8E24AA', dark: '#BA68C8' },
    volunteer: { light: '#9C27B0', dark: '#AB47BC' },

    // Action relationships - oranges/reds
    owns: { light: '#F57C00', dark: '#FFB74D' },
    created: { light: '#E65100', dark: '#FFAB40' },
    associated_with: { light: '#FF9800', dark: '#FFB74D' },
    influenced: { light: '#FF6F00', dark: '#FFCC02' },
    supported: { light: '#4CAF50', dark: '#81C784' },
    opposed: { light: '#F44336', dark: '#EF5350' },
    collaborated: { light: '#00BCD4', dark: '#4DD0E1' },
    competed: { light: '#FF5722', dark: '#FF8A65' },
  };

  const colors = colorMap[relationshipType.toLowerCase()];
  if (colors) {
    return isDark ? colors.dark : colors.light;
  }

  // Default color for unknown relationship types
  return isDark ? '#90A4AE' : '#546E7A';
};

export default function ConnectionLine({
  connectionId,
  startX,
  startY,
  endX,
  endY,
  relationshipType,
  startArrow,
  endArrow,
  isSelected = false,
  isDragging = false,
  tags = [],
  description,
  sourceType,
  sourceName,
  targetName,
  offsetIndex = 0,
  onDelete,
}: ConnectionLineProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const color = getRelationshipColor(relationshipType, isDark);
  const [isHovered, setIsHovered] = React.useState(false);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  // Handle tooltip persistence
  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Don't hide tooltip immediately - let user hover over it
    setTimeout(() => {
      if (!isHovered) {
        setShowTooltip(false);
      }
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    setIsHovered(true);
  };

  const handleTooltipMouseLeave = () => {
    setIsHovered(false);
    setShowTooltip(false);
  };

  // Delete handlers
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete(connectionId);
    }
    setDeleteConfirmOpen(false);
    setShowTooltip(false);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
  };

  // Calculate line properties
  const strokeWidth = isSelected ? 3 : 2;
  const opacity = isDragging ? 0.6 : 1;
  const cornerRadius = 8; // Rounded corner radius matching entity corners

  // Calculate arrow properties
  const arrowSize = 3;

  // Create unique IDs for arrow markers
  const startMarkerId = `arrow-start-${relationshipType}-${startX}-${startY}`;
  const endMarkerId = `arrow-end-${relationshipType}-${endX}-${endY}`;

  // Create flowchart-style path with 90-degree turns
  const createFlowchartPath = () => {
    const extensionDistance = 10; // Fixed 10px extension from edges
    const lineSpacing = 4; // Distance between parallel lines

    // For entities, extend left (negative direction)
    // For events, extend right (positive direction)
    // Use sourceType if available, otherwise fall back to position heuristic
    const isStartEntity = sourceType ? sourceType === 'entity' : startX < endX;
    const baseExtensionX = isStartEntity ? startX - extensionDistance : startX + extensionDistance;

    // Apply offset based on routing index (can be negative for center-balanced distribution)
    // For entities, offset should go further left (more negative), never right
    // For events, offset should go further right (more positive), never left
    const offsetDirection = isStartEntity ? -1 : 1; // Offset away from the entity
    const lineOffset = offsetIndex * lineSpacing * offsetDirection;
    const lineX = baseExtensionX + lineOffset;

    // Build path with rounded corners at ALL bends: out -> vertical -> in
    let pathData = `M ${startX} ${startY}`;

    const horizontalDistance1 = Math.abs(lineX - startX);
    const horizontalDistance2 = Math.abs(endX - lineX);
    const verticalDistance = Math.abs(endY - startY);

    // Only use rounded corners if there's enough space for them
    const canRoundFirstCorner = horizontalDistance1 > cornerRadius && verticalDistance > cornerRadius * 2;
    const canRoundSecondCorner = horizontalDistance2 > cornerRadius && verticalDistance > cornerRadius * 2;

    if (canRoundFirstCorner && canRoundSecondCorner) {
      // Full 4-segment path with rounded corners: horizontal -> vertical -> horizontal
      const verticalDirection = endY > startY ? 1 : -1;
      const horizontalDirection1 = lineX > startX ? 1 : -1;
      const horizontalDirection2 = endX > lineX ? 1 : -1;

      // First horizontal segment (from start toward lineX, stopping before corner)
      const firstCornerX = startX + (horizontalDistance1 - cornerRadius) * horizontalDirection1;
      pathData += ` L ${firstCornerX} ${startY}`;

      // First rounded corner (horizontal to vertical transition)
      pathData += ` Q ${lineX} ${startY} ${lineX} ${startY + (cornerRadius * verticalDirection)}`;

      // Vertical segment (along lineX, from first corner to second corner)
      const secondCornerY = endY - (cornerRadius * verticalDirection);
      pathData += ` L ${lineX} ${secondCornerY}`;

      // Second rounded corner (vertical to horizontal transition)
      pathData += ` Q ${lineX} ${endY} ${lineX + (cornerRadius * horizontalDirection2)} ${endY}`;

      // Final horizontal segment to exact end point
      pathData += ` L ${endX} ${endY}`;
    } else {
      // Fallback for tight spaces - use sharp corners
      pathData += ` L ${lineX} ${startY}`;
      pathData += ` L ${lineX} ${endY}`;
      pathData += ` L ${endX} ${endY}`;
    }

    return pathData;
  };

  const pathData = createFlowchartPath();

  // Calculate midpoint for label positioning
  const midX = startX + (endX - startX) / 2;
  const midY = startY + (endY - startY) / 2;

  return (
    <>
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto', // Allow hover interactions for tooltips
        zIndex: isDragging ? 1000 : -1, // Negative to stay behind all content
      }}
    >
      <defs>
        {/* Start arrow marker */}
        {startArrow === 'arrow' && (
          <marker
            id={startMarkerId}
            markerWidth={arrowSize}
            markerHeight={arrowSize}
            refX={1}
            refY={arrowSize / 2}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points={`0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}`}
              fill={color}
              opacity={opacity}
            />
          </marker>
        )}

        {/* End arrow marker */}
        {endArrow === 'arrow' && (
          <marker
            id={endMarkerId}
            markerWidth={arrowSize}
            markerHeight={arrowSize}
            refX={arrowSize - 1}
            refY={arrowSize / 2}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points={`0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}`}
              fill={color}
              opacity={opacity}
            />
          </marker>
        )}
      </defs>

      {/* Flowchart-style connection path */}
      <path
        d={pathData}
        stroke={color}
        strokeWidth={isHovered ? strokeWidth + 1 : strokeWidth}
        fill="none"
        opacity={opacity}
        strokeDasharray={isSelected ? '5,5' : 'none'}
        markerStart={startArrow === 'arrow' ? `url(#${startMarkerId})` : 'none'}
        markerEnd={endArrow === 'arrow' ? `url(#${endMarkerId})` : 'none'}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        strokeLinecap="round"
        strokeLinejoin="round"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/* Persistent hover tooltip with delete button */}
      {showTooltip && !isDragging && (
        <g onMouseEnter={handleTooltipMouseEnter} onMouseLeave={handleTooltipMouseLeave}>
          {(() => {
            const tooltipLines = [
              relationshipType.replace(/_/g, ' '),
              ...(tags.length > 0 ? [`Tags: ${tags.join(', ')}`] : []),
              ...(description ? [description] : [])
            ];
            const maxLineLength = Math.max(...tooltipLines.map(line => line.length));
            const tooltipWidth = Math.max(150, maxLineLength * 7); // Wider for delete button
            const tooltipHeight = tooltipLines.length * 16 + 40; // Extra height for button

            return (
              <>
                {/* Tooltip background */}
                <rect
                  x={midX - tooltipWidth / 2}
                  y={midY - tooltipHeight / 2 - 20}
                  width={tooltipWidth}
                  height={tooltipHeight}
                  fill={isDark ? '#333333' : '#FFFFFF'}
                  stroke={color}
                  strokeWidth={1}
                  rx={6}
                  opacity={0.95}
                  style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))', pointerEvents: 'all' }}
                />
                {/* Tooltip text lines */}
                {tooltipLines.map((line, index) => (
                  <text
                    key={index}
                    x={midX}
                    y={midY - tooltipHeight / 2 + 15 + (index * 16) - 20}
                    textAnchor="middle"
                    fontSize={12}
                    fill={isDark ? '#FFFFFF' : '#000000'}
                    fontFamily="Roboto, sans-serif"
                    fontWeight={index === 0 ? 'bold' : 'normal'}
                  >
                    {line}
                  </text>
                ))}

                {/* Delete button */}
                <g onClick={handleDeleteClick} style={{ cursor: 'pointer' }}>
                  {/* Button background */}
                  <rect
                    x={midX - 30}
                    y={midY + tooltipHeight / 2 - 35}
                    width={60}
                    height={24}
                    fill="#ef5350"
                    rx={4}
                    style={{ pointerEvents: 'all' }}
                  />
                  {/* Delete icon (simple X) */}
                  <text
                    x={midX - 10}
                    y={midY + tooltipHeight / 2 - 18}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    fontFamily="Roboto, sans-serif"
                    fontWeight="bold"
                  >
                    🗑️ Delete
                  </text>
                </g>
              </>
            );
          })()}
        </g>
      )}

      {/* Connection label for selected state */}
      {isSelected && (
        <g>
          {/* Background rectangle for text */}
          <rect
            x={midX - relationshipType.length * 3}
            y={midY - 10}
            width={relationshipType.length * 6}
            height={20}
            fill={isDark ? '#424242' : '#FFFFFF'}
            stroke={color}
            strokeWidth={1}
            rx={3}
            opacity={0.9}
          />
          {/* Relationship type text */}
          <text
            x={midX}
            y={midY + 5}
            textAnchor="middle"
            fontSize={12}
            fill={isDark ? '#FFFFFF' : '#000000'}
            fontFamily="Roboto, sans-serif"
          >
            {relationshipType.replace(/_/g, ' ')}
          </text>
        </g>
      )}
    </svg>

    {/* Delete Confirmation Dialog */}
    <Dialog
      open={deleteConfirmOpen}
      onClose={handleDeleteCancel}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Delete Connection</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete the connection {sourceName || 'Unknown'} {relationshipType.replace(/_/g, ' ')} {targetName || 'Unknown'}?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDeleteCancel}>Cancel</Button>
        <Button onClick={handleDeleteConfirm} color="error" variant="contained">
          Delete
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}