import mongoose, { Schema, Document } from 'mongoose';

export interface IParsingPerformance extends Document {
  userId: string;
  parsingType: 'url' | 'file';
  tokenCount: number;
  durationMs: number;
  tokensPerSecond: number;
  model: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

const ParsingPerformanceSchema = new Schema<IParsingPerformance>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  parsingType: {
    type: String,
    enum: ['url', 'file'],
    required: true,
  },
  tokenCount: {
    type: Number,
    required: true,
  },
  durationMs: {
    type: Number,
    required: true,
  },
  tokensPerSecond: {
    type: Number,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  success: {
    type: Boolean,
    required: true,
    default: true,
  },
  errorMessage: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Index for efficient querying of recent performance data
ParsingPerformanceSchema.index({ userId: 1, createdAt: -1 });
ParsingPerformanceSchema.index({ userId: 1, parsingType: 1, createdAt: -1 });

export default mongoose.models.ParsingPerformance ||
  mongoose.model<IParsingPerformance>('ParsingPerformance', ParsingPerformanceSchema);
