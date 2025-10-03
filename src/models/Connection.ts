import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  _id: string;
  type: 'event-entity' | 'event-event' | 'entity-entity';
  sourceId: string;
  targetId: string;
  sourceModel: 'Event' | 'Entity';
  targetModel: 'Event' | 'Entity';
  relationshipType: string;
  tags?: string[];
  description?: string;
  startArrow: 'none' | 'arrow';
  endArrow: 'none' | 'arrow';
  timelineId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnection>(
  {
    type: {
      type: String,
      enum: ['event-entity', 'event-event', 'entity-entity'],
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'sourceModel',
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel',
    },
    sourceModel: {
      type: String,
      enum: ['Event', 'Entity'],
      required: true,
    },
    targetModel: {
      type: String,
      enum: ['Event', 'Entity'],
      required: true,
    },
    relationshipType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    tags: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    startArrow: {
      type: String,
      enum: ['none', 'arrow'],
      default: 'none',
    },
    endArrow: {
      type: String,
      enum: ['none', 'arrow'],
      default: 'none',
    },
    timelineId: {
      type: Schema.Types.ObjectId,
      ref: 'Timeline',
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

ConnectionSchema.index({ sourceId: 1, targetId: 1 });
ConnectionSchema.index({ timelineId: 1 });

export default mongoose.models.Connection || mongoose.model<IConnection>('Connection', ConnectionSchema);