import mongoose, { Document, Schema } from 'mongoose';

export interface IChain extends Document {
  _id: string;
  name: string;
  color: string;
  description?: string;
  timelineId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChainSchema = new Schema<IChain>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    color: {
      type: String,
      required: true,
      default: '#1976d2',
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Color must be a valid hex color code',
      },
    },
    description: {
      type: String,
      maxlength: 500,
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

ChainSchema.index({ timelineId: 1 });
ChainSchema.index({ timelineId: 1, name: 1 }, { unique: true });

export default mongoose.models.Chain || mongoose.model<IChain>('Chain', ChainSchema);
