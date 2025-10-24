import mongoose from 'mongoose';

const shareLinkSchema = new mongoose.Schema({
  timelineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timeline',
    required: true,
  },
  shareId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: false,
  },
});

export default mongoose.models.ShareLink || mongoose.model('ShareLink', shareLinkSchema);
