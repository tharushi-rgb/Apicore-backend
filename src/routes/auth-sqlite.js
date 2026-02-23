// Authentication routes with SQLite database
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const body = req.body;
    const name = body.name || body.fullName;
    const email = body.email;
    const password = body.password;
    const phone = body.phone || body.phoneNumber || null;
    const nicNumber = body.nic_number || body.nicNumber || null;
    const district = body.district || null;
    const preferredLanguage = body.preferred_language || body.preferredLanguage || 'en';
    const ageGroup = body.age_group || body.ageGroup || null;
    const knownBeeAllergy = body.known_bee_allergy || body.knownBeeAllergy || 'no';
    const bloodGroup = body.blood_group || body.bloodGroup || null;
    const beekeepingNature = body.beekeeping_nature || body.beekeepingNature || null;
    const businessRegNo = body.business_reg_no || body.businessRegNo || null;
    const primaryBeeSpecies = body.primary_bee_species || body.primaryBeeSpecies || null;
    const nvqLevel = body.nvq_level || body.nvqLevel || null;
    const role = body.role || 'beekeeper';
    const yearsExperience = body.yearsExperience || body.years_experience || 0;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Check if user already exists
    const existingUser = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with full UC1 fields
    const result = await db.prepare(`
      INSERT INTO users (name, email, password, phone, nic_number, district, preferred_language,
        age_group, known_bee_allergy, blood_group, beekeeping_nature, business_reg_no,
        primary_bee_species, nvq_level, role, years_experience)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, hashedPassword, phone, nicNumber, district, preferredLanguage,
      ageGroup, knownBeeAllergy, bloodGroup, beekeepingNature, businessRegNo,
      primaryBeeSpecies, nvqLevel, role, yearsExperience);

    // Get the created user
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Remove password from response
    delete user.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

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

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Remove password from response
    delete user.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private (requires JWT token)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    delete user.password;

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

// Export router and middleware
export default router;
export { authenticateToken };
