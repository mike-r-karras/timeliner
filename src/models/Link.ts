import mongoose, { Document, Schema } from 'mongoose';

export interface ILink extends Document {
  _id: string;
  title: string;
  url: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const LinkSchema = new Schema<ILink>(
  {
    title: {
      type: String,
      required: true,
      maxlength: 500,
    },
    url: {
      type: String,
      required: true,
      maxlength: 2000,
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

// Force model reload in development to pick up schema changes
if (mongoose.models.Link) {
  delete mongoose.models.Link;
}

export default mongoose.model<ILink>('Link', LinkSchema);
