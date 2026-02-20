import mongoose from 'mongoose';

const apiarySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Apiary name is required'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'empty', 'expired'],
    default: 'active'
  },
  establishedDate: {
    type: Date,
    required: true
  },
  environment: {
    type: String
  },
  terrainType: {
    type: String
  },
  location: {
    name: String,
    gps: {
      latitude: Number,
      longitude: Number
    },
    district: {
      type: String,
      required: true
    },
    area: String
  },
  apiaryType: {
    type: String,
    enum: ['personal', 'client'],
    default: 'personal'
  },
  clientInfo: {
    ownerName: String,
    ownerContact: String,
    contractType: String,
    contractStartDate: Date,
    contractEndDate: Date
  },
  forage: {
    types: [String],
    primary: String,
    bloomingPeriod: String
  },
  weather: {
    temp: Number,
    condition: {
      type: String,
      enum: ['sunny', 'cloudy', 'rainy']
    },
    forecast: [String]
  },
  hiveCount: {
    type: Number,
    default: 0
  },
  queenlessHiveCount: {
    type: Number,
    default: 0
  },
  notes: String,
  images: [String],
  helperPermissions: {
    showLocation: { type: Boolean, default: true },
    showContract: { type: Boolean, default: false },
    showForage: { type: Boolean, default: true }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
apiarySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Apiary = mongoose.model('Apiary', apiarySchema);

export default Apiary;
