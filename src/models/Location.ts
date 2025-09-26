import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
  _id: string;
  name: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  radius?: number;
  description?: string;
  formattedAddress?: string;
  placeId?: string;
  geocoded: boolean;
  geocodingSource?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    streetAddress: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    stateProvince: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'United States',
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    radius: {
      type: Number,
      min: 0,
      max: 10000000,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    formattedAddress: {
      type: String,
      maxlength: 500,
    },
    placeId: {
      type: String,
      maxlength: 100,
    },
    geocoded: {
      type: Boolean,
      default: false,
    },
    geocodingSource: {
      type: String,
      maxlength: 50,
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

LocationSchema.index({ latitude: 1, longitude: 1 });
LocationSchema.index({ city: 1, stateProvince: 1 });
LocationSchema.index({ postalCode: 1 });
LocationSchema.index({ createdBy: 1 });

export default mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema);