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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { Search, Edit, Add, Delete } from '@mui/icons-material';
import AttachmentViewer from './AttachmentViewer';

interface Entity {
  _id: string;
  name: string;
  type: 'person' | 'organization' | 'place' | 'object' | 'concept' | 'other';
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

interface Connection {
  _id: string;
  type: 'event-entity' | 'event-event' | 'entity-entity';
  sourceId: any;
  targetId: any;
  sourceModel: 'Event' | 'Entity';
  targetModel: 'Event' | 'Entity';
}

interface EntitiesPanelProps {
  timelineId?: string | null;
  selectedItems?: SelectedItems;
  onSelection?: (type: 'event' | 'entity' | 'location', ids: string[], append?: boolean) => void;
  onEditEntity?: (entityId: string) => void;
  onAddEntity?: () => void;
  refreshTrigger?: number;
  onEntitiesFiltered?: (entityIds: string[]) => void;
  visibleEventIds?: string[];
}

const getEntityTypeColor = (type: string) => {
  switch (type) {
    case 'person':
      return 'primary';
    case 'organization':
      return 'secondary';
    case 'place':
      return 'success';
    case 'object':
      return 'warning';
    case 'concept':
      return 'info';
    default:
      return 'default';
  }
};

export default function EntitiesPanel({ timelineId, selectedItems, onSelection, onEditEntity, onAddEntity, refreshTrigger, onEntitiesFiltered, visibleEventIds }: EntitiesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityAttachments, setEntityAttachments] = useState<Record<string, Attachment[]>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (timelineId) {
      fetchEntities();
    }
  }, [timelineId, refreshTrigger]);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const [entitiesResponse, attachmentsResponse, connectionsResponse] = await Promise.all([
        fetch(`/api/entities?timelineId=${timelineId}`),
        fetch(`/api/attachments?timelineId=${timelineId}&type=entities`),
        fetch(`/api/connections?timelineId=${timelineId}`)
      ]);

      if (entitiesResponse.ok) {
        const data = await entitiesResponse.json();
        setEntities(data);
      }

      if (attachmentsResponse.ok) {
        const attachmentsByEntity = await attachmentsResponse.json();
        setEntityAttachments(attachmentsByEntity);
      }

      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json();
        setConnections(connectionsData);
        console.log('[EntitiesPanel] Fetched connections:', connectionsData.length);
      }
    } catch (error) {
      console.error('Error fetching entities data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityClick = (entityId: string, shiftKey: boolean, entityName: string) => {
    // Normal selection behavior
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

  // Delete entity handlers
  const handleDeleteEntity = (entity: Entity) => {
    setEntityToDelete(entity);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteEntity = async () => {
    if (!entityToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/entities/${entityToDelete._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchEntities(); // Refresh the entities
        setDeleteConfirmOpen(false);
        setEntityToDelete(null);
      } else {
        console.error('Failed to delete entity');
      }
    } catch (error) {
      console.error('Error deleting entity:', error);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteEntity = () => {
    setDeleteConfirmOpen(false);
    setEntityToDelete(null);
  };

  // Filter entities by visibility (connected to visible events)
  const visibilityFilteredEntities = React.useMemo(() => {
    // If no visible events specified, show all entities
    if (!visibleEventIds || visibleEventIds.length === 0) {
      return entities;
    }

    // Find entity IDs that are connected to visible events
    const connectedEntityIds = new Set<string>();

    connections.forEach((conn) => {
      // Skip if sourceId or targetId is null (deleted item)
      if (!conn.sourceId || !conn.targetId) return;

      const sourceIdStr = typeof conn.sourceId === 'object' ? conn.sourceId._id : conn.sourceId;
      const targetIdStr = typeof conn.targetId === 'object' ? conn.targetId._id : conn.targetId;

      // Skip if we couldn't extract IDs
      if (!sourceIdStr || !targetIdStr) return;

      // If source is a visible event and target is an entity
      if (conn.sourceModel === 'Event' && conn.targetModel === 'Entity' && visibleEventIds.includes(sourceIdStr)) {
        connectedEntityIds.add(targetIdStr);
      }
      // If target is a visible event and source is an entity
      if (conn.targetModel === 'Event' && conn.sourceModel === 'Entity' && visibleEventIds.includes(targetIdStr)) {
        connectedEntityIds.add(sourceIdStr);
      }
    });

    console.log('[EntitiesPanel] Visible events:', visibleEventIds.length, 'Connected entities:', connectedEntityIds.size);

    // Filter to only entities connected to visible events
    return entities.filter(entity => connectedEntityIds.has(entity._id));
  }, [entities, connections, visibleEventIds]);

  // Filter by search term
  const filteredEntities = visibilityFilteredEntities.filter(entity =>
    entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Notify parent component when entities are filtered (both by visibility and search)
  const filteredEntityIds = React.useMemo(() =>
    filteredEntities.map(entity => entity._id),
    [filteredEntities]
  );

  const prevFilteredEntityIdsRef = React.useRef<string[]>([]);

  useEffect(() => {
    if (onEntitiesFiltered) {
      // Only call if the IDs have actually changed
      const idsChanged =
        filteredEntityIds.length !== prevFilteredEntityIdsRef.current.length ||
        filteredEntityIds.some((id, index) => id !== prevFilteredEntityIdsRef.current[index]);

      if (idsChanged) {
        prevFilteredEntityIdsRef.current = filteredEntityIds;
        onEntitiesFiltered(filteredEntityIds);
      }
    }
  }, [filteredEntityIds, onEntitiesFiltered]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      <Box
        sx={{
          flex: 1,
          maxHeight: '80vh',
          overflow: 'auto',
          p: 1,
          pl: 3,
          minHeight: 0, // Ensure flex child can shrink
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0,0,0,0.3)',
            },
          },
        }}
      >
        {filteredEntities.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {entities.length === 0
                ? 'No entities in this timeline. Click the + button to add entities.'
                : visibleEventIds && visibleEventIds.length > 0 && visibilityFilteredEntities.length === 0
                  ? 'No entities connected to visible events.'
                  : 'No entities match your search.'
              }
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredEntities.map((entity) => (
              <Card
                key={entity._id}
                data-entity-id={entity._id}
                sx={{
                  cursor: 'pointer',
                  border: isEntitySelected(entity._id) ? '2px solid' : '1px solid',
                  borderColor: isEntitySelected(entity._id) ? 'primary.main' : 'divider',
                  backgroundColor: isEntitySelected(entity._id) ? 'primary.50' : 'background.paper',
                  '&:hover': { elevation: 2 },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEntityClick(entity._id, e.shiftKey, entity.name);
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ flex: 1, fontSize: '0.95rem' }} className="entity-name">
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
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntity(entity);
                        }}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
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
                      {entityAttachments[entity._id].map((attachment) => (
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelDeleteEntity}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Confirm that you want to delete "{entityToDelete?.name}"
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={cancelDeleteEntity}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteEntity}
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