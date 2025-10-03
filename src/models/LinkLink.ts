import mongoose, { Document, Schema } from 'mongoose';

export interface ILinkLink extends Document {
  _id: string;
  linkId: string;
  eventId?: string;
  entityId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const LinkLinkSchema = new Schema<ILinkLink>(
  {
    linkId: {
      type: Schema.Types.ObjectId,
      ref: 'Link',
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
LinkLinkSchema.pre('validate', function() {
  if (!this.eventId && !this.entityId) {
    throw new Error('Either eventId or entityId must be provided');
  }
});

// Compound indexes for efficient queries
LinkLinkSchema.index({ eventId: 1, linkId: 1 });
LinkLinkSchema.index({ entityId: 1, linkId: 1 });

// Force model reload in development to pick up schema changes
if (mongoose.models.LinkLink) {
  delete mongoose.models.LinkLink;
}

export default mongoose.model<ILinkLink>('LinkLink', LinkLinkSchema);
