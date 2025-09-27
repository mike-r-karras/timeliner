import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachmentLink extends Document {
  _id: string;
  attachmentId: string;
  eventId?: string;
  entityId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentLinkSchema = new Schema<IAttachmentLink>(
  {
    attachmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Attachment',
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      ref: 'Entity',
      required: false,
      index: true,
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

// Ensure at least one of eventId or entityId is provided
AttachmentLinkSchema.pre('validate', function() {
  if (!this.eventId && !this.entityId) {
    throw new Error('Either eventId or entityId must be provided');
  }
});

// Compound indexes for efficient queries
AttachmentLinkSchema.index({ eventId: 1, attachmentId: 1 });
AttachmentLinkSchema.index({ entityId: 1, attachmentId: 1 });

export default mongoose.models.AttachmentLink || mongoose.model<IAttachmentLink>('AttachmentLink', AttachmentLinkSchema);