'use client';

import React from 'react';
import { useTheme } from '@mui/material/styles';

interface ConnectionLineProps {
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
}: ConnectionLineProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const color = getRelationshipColor(relationshipType, isDark);
  const [isHovered, setIsHovered] = React.useState(false);

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

    // For entities, extend left (negative direction)
    // For events, extend right (positive direction)
    // Use sourceType if available, otherwise fall back to position heuristic
    const isStartEntity = sourceType ? sourceType === 'entity' : startX < endX;
    const startExtensionX = isStartEntity ? startX - extensionDistance : startX + extensionDistance;

    // Keep the entire line at the same horizontal position as the first extension
    const lineX = startExtensionX;

    // Build path with rounded corners - entire line stays at same X position
    let pathData = `M ${startX} ${startY}`;

    // Calculate the horizontal distance for the first segment
    const horizontalDistance = Math.abs(lineX - startX);

    // Vertical segment along the line position
    if (Math.abs(endY - startY) > cornerRadius && horizontalDistance > cornerRadius) {
      const verticalDirection = endY > startY ? 1 : -1;
      const horizontalDirection = lineX > startX ? 1 : -1;

      // Horizontal extension with rounded corner at the bend
      const firstCornerX = startX + (horizontalDistance - cornerRadius) * horizontalDirection;
      pathData += ` L ${firstCornerX} ${startY}`;

      // First rounded corner (horizontal to vertical transition)
      pathData += ` Q ${lineX} ${startY} ${lineX} ${startY + (cornerRadius * verticalDirection)}`;

      // Vertical line to near the target level
      const verticalEndY = endY - (cornerRadius * verticalDirection);
      if (Math.abs(verticalEndY - (startY + cornerRadius * verticalDirection)) > 0) {
        pathData += ` L ${lineX} ${verticalEndY}`;
      }

      // Rounded corner toward target
      const finalHorizontalDirection = endX > lineX ? 1 : -1;
      pathData += ` Q ${lineX} ${endY} ${lineX + (cornerRadius * finalHorizontalDirection)} ${endY}`;

      // Final horizontal segment to exact end point
      pathData += ` L ${endX} ${endY}`;
    } else {
      // Direct connection for short distances or minimal height differences
      pathData += ` L ${lineX} ${startY}`;
      pathData += ` L ${endX} ${endY}`;
    }

    return pathData;
  };

  const pathData = createFlowchartPath();

  // Calculate midpoint for label positioning
  const midX = startX + (endX - startX) / 2;
  const midY = startY + (endY - startY) / 2;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: isDragging ? 1000 : 1,
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Hover tooltip */}
      {isHovered && !isDragging && (
        <g>
          {(() => {
            const tooltipLines = [
              relationshipType.replace(/_/g, ' '),
              ...(tags.length > 0 ? [`Tags: ${tags.join(', ')}`] : []),
              ...(description ? [description] : [])
            ];
            const maxLineLength = Math.max(...tooltipLines.map(line => line.length));
            const tooltipWidth = Math.max(120, maxLineLength * 7);
            const tooltipHeight = tooltipLines.length * 16 + 10;

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
                  style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))' }}
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
  );
}