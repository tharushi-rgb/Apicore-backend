import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },
  nicNumber: {
    type: String,
    required: [true, 'NIC number is required'],
    unique: true
  },
  role: {
    type: String,
    enum: ['beekeeper', 'helper'],
    default: 'beekeeper'
  },
  district: {
    type: String
  },
  preferredLanguage: {
    type: String,
    enum: ['en', 'si', 'ta'],
    default: 'en'
  },
  ageGroup: {
    type: String
  },
  knownBeeAllergy: {
    type: String,
    enum: ['yes', 'no', 'unknown'],
    default: 'unknown'
  },
  bloodGroup: {
    type: String
  },
  beekeepingNature: {
    type: String
  },
  primaryBeeSpecies: {
    type: String
  },
  nvqTrainingLevel: {
    type: String
  },
  // Helper specific fields
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitationToken: String,
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
