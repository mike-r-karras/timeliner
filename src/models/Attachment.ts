import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachment extends Document {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: 'article' | 'photo' | 'video' | 'audio' | 'link' | 'document' | 'other';
  contentHash: string;
  data: Buffer;
  caption?: string;
  altText?: string;
  creator?: string;
  creditLine?: string;
  copyright?: string;
  date?: Date;
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
    contentHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    caption: {
      type: String,
      maxlength: 1000,
    },
    altText: {
      type: String,
      maxlength: 500,
    },
    creator: {
      type: String,
      maxlength: 255,
    },
    creditLine: {
      type: String,
      maxlength: 255,
    },
    copyright: {
      type: String,
      maxlength: 500,
    },
    date: {
      type: Date,
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

// Index for efficient content hash lookups
AttachmentSchema.index({ contentHash: 1 });

// Force model reload in development to pick up schema changes
if (mongoose.models.Attachment) {
  delete mongoose.models.Attachment;
}

export default mongoose.model<IAttachment>('Attachment', AttachmentSchema);