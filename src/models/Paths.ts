import mongoose, { Document, Schema } from 'mongoose';
import { start } from 'repl';

export interface IPath extends Document {
  _id: string;
  name: string;
  routed: boolean;
  mode: 'walking' | 'driving' | 'bicycling' | 'transit' | 'straight' | 'geodesic' | 'horseback' | 'flying' | 'sailing' | 'other';
  icon?: string;
  startLocationName?: string;
  startStreetAddress?: string;
  startCity?: string;
  startStateProvince?: string;
  startPostalCode?: string;
  startCountry?: string;
  startLatitude: number;
  startLongitude: number;
  startTime?: Date;
  endTime?: Date;
  endLocationName?: string;
  endStreetAddress?: string;
  endCity?: string;
  endStateProvince?: string;
  endPostalCode?: string;
  endCountry?: string;
  endLatitude: number;
  endLongitude: number;
  description?: string;
  startFormattedAddress?: string;
  endFormattedAddress?: string;
  geocoded: boolean;
  geocodingSource?: string;
  style: string;
  coordinates: [number, number][];
  duration: number;
  durationSegments: [number, number][];
  waypoints: [number, number][];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
const PathSchema = new Schema<IPath>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
  },
    routed: {
      type: Boolean,
      required: true,
      default: false,
    },
    mode: {
      type: String,
      required: true,
      enum: ['bicycling', 'driving', 'flying', 'geodesic', 'horseback', 'other', 'sailing', 'straight', 'transit', 'walking'], 
      default: 'straight',
    },
    icon: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    startLocationName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    startStreetAddress: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    startCity: {
        type: String,
        trim: true,
        maxlength: 100,
    },
    startStateProvince: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    startPostalCode: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    startCountry: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'United States',
    },
    startLatitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    startLongitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    startTime: {
      type: Date,
    },
    endLocationName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    endStreetAddress: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    endCity: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    endStateProvince: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    endPostalCode: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    endCountry: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'United States',
    },
    endLatitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    endLongitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    endTime: {
      type: Date,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    formattedAddress: {
      type: String,
        maxlength: 500,
    },
    geocoded: {
      type: Boolean,
      required: true,
      default: false,
    },
    geocodingSource: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    duration: {
      type: Number,
      required: false
    },
    coordinates: {
      type: [[Number, Number]],
      required: false
    },
    durationSegments: {
      type: [[Number, Number]],
      required: false
    },
    waypoints: {
      type: [[Number, Number]],
      required: false
    },
    style: {
      type: String,
      required: true
      },
    pathStyle: {
      type: String,
      required: false,  
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
PathSchema.index({ createdBy: 1 });
PathSchema.index({ startLatitude: 1, startLongitude: 1 });
PathSchema.index({ endLatitude: 1, endLongitude: 1 });
PathSchema.index({ name: 'text'});
PathSchema.index({ startPostalCode: 1 });
PathSchema.index({ endPostalCode: 1 });
PathSchema.index({ startTime: 1 });
PathSchema.index({ endTime: 1 });
PathSchema.index({ startCity: 1, startStateProvince: 1, startCountry: 1 });
PathSchema.index({ endCity: 1, endStateProvince: 1, endCountry: 1 });

export default mongoose.models.Path || mongoose.model<IPath>('Path', PathSchema);