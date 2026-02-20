import mongoose from 'mongoose';

const hiveSchema = new mongoose.Schema({
  hiveId: {
    type: String,
    required: [true, 'Hive ID is required'],
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Hive name is required'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'queenless', 'inactive', 'absconded'],
    default: 'active'
  },
  locationType: {
    type: String,
    enum: ['apiary-linked', 'standalone'],
    default: 'apiary-linked'
  },
  apiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Apiary'
  },
  standaloneLocation: {
    name: String,
    gps: {
      latitude: Number,
      longitude: Number
    },
    district: String
  },
  hiveType: {
    type: String,
    enum: ['box', 'pot', 'log', 'stingless'],
    required: true
  },
  hiveDetails: {
    // Box hive specific
    numberOfFrames: Number,
    entrancePositions: [String],
    antProtection: Boolean,
    // Pot hive specific
    potMaterial: String,
    internalVolume: Number,
    entranceHoleDiameter: Number,
    shadeLevel: String,
    rainProtection: Boolean,
    // Log hive specific
    woodType: String,
    logLength: Number,
    cavityDiameter: Number,
    placementHeight: Number,
    // Stingless hive specific
    boxVolume: Number,
    entranceTubeType: String
  },
  colony: {
    beeSpecies: {
      type: String,
      required: true
    },
    origin: String,
    strength: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    strengthLabel: {
      type: String,
      enum: ['weak', 'normal', 'strong']
    }
  },
  queen: {
    present: {
      type: Boolean,
      default: true
    },
    age: Number,
    ageRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    introductionDate: Date
  },
  inspection: {
    lastDate: Date,
    daysAgo: Number,
    overdue: {
      type: Boolean,
      default: false
    }
  },
  pest: {
    detected: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: false
    },
    reportedDate: Date,
    type: String
  },
  ownership: {
    type: {
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
    }
  },
  tags: [String],
  notes: String,
  images: [String],
  helperPermissions: {
    showLocation: { type: Boolean, default: true },
    showColony: { type: Boolean, default: true },
    showNotes: { type: Boolean, default: false }
  },
  dateEstablished: {
    type: Date,
    default: Date.now
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
hiveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate queen age risk
  if (this.queen.age) {
    if (this.queen.age < 1.5) {
      this.queen.ageRisk = 'low';
    } else if (this.queen.age < 2.5) {
      this.queen.ageRisk = 'medium';
    } else {
      this.queen.ageRisk = 'high';
    }
  }
  
  // Calculate colony strength label
  if (this.colony.strength <= 33) {
    this.colony.strengthLabel = 'weak';
  } else if (this.colony.strength <= 66) {
    this.colony.strengthLabel = 'normal';
  } else {
    this.colony.strengthLabel = 'strong';
  }
  
  next();
});

const Hive = mongoose.model('Hive', hiveSchema);

export default Hive;
