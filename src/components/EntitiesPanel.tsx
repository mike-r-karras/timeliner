'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Rating,
} from '@mui/material';
import { Search, Edit, Add } from '@mui/icons-material';
import AttachmentViewer from './AttachmentViewer';

interface Entity {
  _id: string;
  name: string;
  type: 'person' | 'organization' | 'object' | 'concept' | 'other';
  description?: string;
  importance: number;
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

interface SelectedItems {
  events: string[];
  entities: string[];
  locations: string[];
}

interface EntitiesPanelProps {
  timelineId?: string | null;
  selectedItems?: SelectedItems;
  onSelection?: (type: 'event' | 'entity' | 'location', ids: string[], append?: boolean) => void;
  onEditEntity?: (entityId: string) => void;
  onAddEntity?: () => void;
}

const getEntityTypeColor = (type: string) => {
  switch (type) {
    case 'person':
      return 'primary';
    case 'organization':
      return 'secondary';
    case 'location':
      return 'success';
    case 'object':
      return 'warning';
    case 'concept':
      return 'info';
    default:
      return 'default';
  }
};

export default function EntitiesPanel({ timelineId, selectedItems, onSelection, onEditEntity, onAddEntity }: EntitiesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityAttachments, setEntityAttachments] = useState<Record<string, Attachment[]>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);

  useEffect(() => {
    if (timelineId) {
      fetchEntities();
    }
  }, [timelineId]);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/entities?timelineId=${timelineId}`);
      if (response.ok) {
        const data = await response.json();
        setEntities(data);

        // Fetch attachments for each entity
        const attachmentsMap: Record<string, Attachment[]> = {};
        for (const entity of data) {
          try {
            const attachResponse = await fetch(`/api/attachments?entityId=${entity._id}`);
            if (attachResponse.ok) {
              const attachments = await attachResponse.json();
              attachmentsMap[entity._id] = attachments;
            }
          } catch (error) {
            console.error(`Error fetching attachments for entity ${entity._id}:`, error);
          }
        }
        setEntityAttachments(attachmentsMap);
      }
    } catch (error) {
      console.error('Error fetching entities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityClick = (entityId: string, shiftKey: boolean) => {
    if (onSelection) {
      onSelection('entity', [entityId], shiftKey);
    }
  };

  const isEntitySelected = (entityId: string) => {
    return selectedItems?.entities?.includes(entityId) || false;
  };

  const handleAttachmentClick = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    setSelectedAttachment(null);
  };

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Entities
          </Typography>
          {onAddEntity && (
            <IconButton
              size="small"
              onClick={onAddEntity}
              sx={{ color: 'primary.main' }}
            >
              <Add fontSize="small" />
            </IconButton>
          )}
        </Box>

        <TextField
          fullWidth
          placeholder="Search entities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Entities List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {filteredEntities.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {entities.length === 0
                ? 'No entities in this timeline. Click the + button to add entities.'
                : 'No entities match your search.'
              }
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredEntities.map((entity) => (
              <Card
                key={entity._id}
                sx={{
                  cursor: 'pointer',
                  border: isEntitySelected(entity._id) ? '2px solid' : '1px solid',
                  borderColor: isEntitySelected(entity._id) ? 'primary.main' : 'divider',
                  '&:hover': { elevation: 2 }
                }}
                onClick={(e) => handleEntityClick(entity._id, e.shiftKey)}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ flex: 1, fontSize: '0.95rem' }}>
                      {entity.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rating
                        value={entity.importance || 0}
                        readOnly
                        size="small"
                      />
                      <Chip
                        label={entity.type}
                        size="small"
                        color={getEntityTypeColor(entity.type) as any}
                      />
                      {onEditEntity && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEntity(entity._id);
                          }}
                          sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  {entity.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        mb: 1,
                      }}
                    >
                      {entity.description}
                    </Typography>
                  )}

                  {/* Attachment thumbnails */}
                  {entityAttachments[entity._id] && entityAttachments[entity._id].length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {entityAttachments[entity._id].slice(0, 3).map((attachment) => (
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
                      {entityAttachments[entity._id].length > 3 && (
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
                          +{entityAttachments[entity._id].length - 3}
                        </Box>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
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