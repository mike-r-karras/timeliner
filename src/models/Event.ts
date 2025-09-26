import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  _id: string;
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime?: Date;
  importance: 1 | 2 | 3 | 4 | 5;
  thumbnailUrl?: string;
  locationId?: string;
  timelineId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      maxlength: 5000,
    },
    startDateTime: {
      type: Date,
      required: true,
    },
    endDateTime: {
      type: Date,
    },
    importance: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      default: 3,
    },
    thumbnailUrl: {
      type: String,
      maxlength: 500,
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
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

EventSchema.index({ timelineId: 1, startDateTime: 1 });
EventSchema.index({ startDateTime: 1 });

export default mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);