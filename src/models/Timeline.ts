import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeline extends Document {
  _id: string;
  title: string;
  description?: string;
  timezone?: string;
  createdBy: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TimelineSchema = new Schema<ITimeline>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: 'Untitled',
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    timezone: {
      type: String,
      default: 'UTC',
      maxlength: 100,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

TimelineSchema.index({ createdBy: 1 });

export default mongoose.models.Timeline || mongoose.model<ITimeline>('Timeline', TimelineSchema);