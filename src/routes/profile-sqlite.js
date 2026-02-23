// Profile routes with SQLite database
import express from 'express';
import bcrypt from 'bcrypt';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/profile
// @desc    Get current user profile
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove password from response
    delete user.password;

    // Get user statistics
    const apiaryRow = await db.prepare('SELECT COUNT(*) as count FROM apiaries WHERE user_id = ?').get(req.userId);
    const totalApiaries = apiaryRow ? apiaryRow.count : 0;
    const hiveRow = await db.prepare('SELECT COUNT(*) as count FROM hives WHERE user_id = ?').get(req.userId);
    const totalHives = hiveRow ? hiveRow.count : 0;
    const harvestRow = await db.prepare('SELECT COUNT(*) as count FROM harvests WHERE user_id = ?').get(req.userId);
    const totalHarvests = harvestRow ? harvestRow.count : 0;

    res.json({
      success: true,
      data: {
        user,
        stats: {
          totalApiaries,
          totalHives,
          totalHarvests
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/profile
// @desc    Update user profile
// @access  Private
router.put('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body;
    const name = body.name;
    const phone = body.phone || body.phoneNumber;
    const district = body.district;
    const yearsExperience = body.yearsExperience || body.years_experience;
    const nicNumber = body.nic_number || body.nicNumber;
    const preferredLanguage = body.preferred_language || body.preferredLanguage;
    const ageGroup = body.age_group || body.ageGroup;
    const knownBeeAllergy = body.known_bee_allergy || body.knownBeeAllergy;
    const bloodGroup = body.blood_group || body.bloodGroup;
    const beekeepingNature = body.beekeeping_nature || body.beekeepingNature;
    const businessRegNo = body.business_reg_no || body.businessRegNo;
    const primaryBeeSpecies = body.primary_bee_species || body.primaryBeeSpecies;
    const nvqLevel = body.nvq_level || body.nvqLevel;

    // Get current user
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user profile with all UC1 fields
    await db.prepare(`
      UPDATE users 
      SET name = ?, phone = ?, district = ?, years_experience = ?,
          nic_number = ?, preferred_language = ?, age_group = ?,
          known_bee_allergy = ?, blood_group = ?, beekeeping_nature = ?,
          business_reg_no = ?, primary_bee_species = ?, nvq_level = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || user.name,
      phone !== undefined ? phone : user.phone,
      district || user.district,
      yearsExperience !== undefined ? yearsExperience : user.years_experience,
      nicNumber !== undefined ? nicNumber : user.nic_number,
      preferredLanguage || user.preferred_language || 'en',
      ageGroup !== undefined ? ageGroup : user.age_group,
      knownBeeAllergy !== undefined ? knownBeeAllergy : user.known_bee_allergy,
      bloodGroup !== undefined ? bloodGroup : user.blood_group,
      beekeepingNature !== undefined ? beekeepingNature : user.beekeeping_nature,
      businessRegNo !== undefined ? businessRegNo : user.business_reg_no,
      primaryBeeSpecies !== undefined ? primaryBeeSpecies : user.primary_bee_species,
      nvqLevel !== undefined ? nvqLevel : user.nvq_level,
      req.userId
    );

    // Get updated user
    const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    delete updatedUser.password;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/profile/password
// @desc    Change user password
// @access  Private
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Get user with password
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.userId);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
