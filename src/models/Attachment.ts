import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachment extends Document {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: 'article' | 'photo' | 'video' | 'audio' | 'link' | 'document' | 'other';
  eventId?: string;
  entityId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    filename: {
      type: String,
      required: true,
      maxlength: 255,
    },
    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    url: {
      type: String,
      required: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ['article', 'photo', 'video', 'audio', 'link', 'document', 'other'],
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      ref: 'Entity',
      required: false,
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

AttachmentSchema.index({ eventId: 1 });
AttachmentSchema.index({ entityId: 1 });

export default mongoose.models.Attachment || mongoose.model<IAttachment>('Attachment', AttachmentSchema);