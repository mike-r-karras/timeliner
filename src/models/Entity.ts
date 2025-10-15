import mongoose, { Document, Schema } from 'mongoose';

export interface IEntity extends Document {
  _id: string;
  name: string;
  type: 'person' | 'organization' | 'place' | 'object' | 'concept' | 'other';
  description?: string;
  importance: number;
  locationId?: string;
  timelineId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const EntitySchema = new Schema<IEntity>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ['person', 'organization', 'place', 'object', 'concept', 'other'],
      required: true,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    importance: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: false,
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

EntitySchema.index({ timelineId: 1 });
EntitySchema.index({ name: 1 });
// Prevent duplicate entities within the same timeline
EntitySchema.index({ timelineId: 1, name: 1 }, { unique: true });

export default mongoose.models.Entity || mongoose.model<IEntity>('Entity', EntitySchema);