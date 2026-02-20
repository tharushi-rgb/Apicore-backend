import express from 'express';
import bcrypt from 'bcryptjs';
import { demoUsers, generateToken, protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      password, 
      phoneNumber, 
      nicNumber,
      role = 'beekeeper',
      district,
      preferredLanguage,
      ageGroup,
      knownBeeAllergy,
      bloodGroup,
      beekeepingNature,
      primaryBeeSpecies,
      nvqTrainingLevel
    } = req.body;

    // Check if user exists
    const existingUser = demoUsers.find(u => u.email === email || u.nicNumber === nicNumber);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or NIC'
      });
    }

    // Create new user (in demo mode, just return success)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      _id: `demo-user-${Date.now()}`,
      fullName,
      email,
      password: hashedPassword,
      phoneNumber,
      nicNumber,
      role,
      district,
      preferredLanguage: preferredLanguage || 'en',
      ageGroup,
      knownBeeAllergy,
      bloodGroup,
      beekeepingNature,
      primaryBeeSpecies,
      nvqTrainingLevel,
      isActive: true
    };

    demoUsers.push(newUser);

    const token = generateToken(newUser._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          _id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
          district: newUser.district,
          preferredLanguage: newUser.preferredLanguage
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = demoUsers.find(u => u.email === emailOrUsername);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          district: user.district,
          preferredLanguage: user.preferredLanguage
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    data: {
      _id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      district: req.user.district,
      preferredLanguage: req.user.preferredLanguage
    }
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  const user = demoUsers.find(u => u.email === email);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'No user found with this email'
    });
  }

  // In demo mode, just return success
  res.json({
    success: true,
    message: 'Password reset instructions sent to email'
  });
});

export default router;
