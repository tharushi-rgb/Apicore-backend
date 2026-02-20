import express from 'express';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Demo hives data
const demoHives = [
  {
    _id: 'H-07',
    hiveId: 'H-07',
    name: 'H-07',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'apiary-linked',
    apiary: 'APY-001',
    apiaryName: 'Kegalle Rubber Land',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Local capture',
      strength: 60,
      strengthLabel: 'normal'
    },
    queen: {
      present: true,
      age: 2.7,
      ageRisk: 'high'
    },
    inspection: {
      lastDate: '2026-01-26',
      daysAgo: 8,
      overdue: false
    },
    pest: { detected: false, active: false },
    tags: ['Queen Change Due'],
    dateEstablished: '2024-05-10'
  },
  {
    _id: 'H-12',
    hiveId: 'H-12',
    name: 'H-12',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'apiary-linked',
    apiary: 'APY-002',
    apiaryName: 'Kurunegala Coconut Plot',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Split',
      strength: 80,
      strengthLabel: 'strong'
    },
    queen: {
      present: true,
      age: 1.2,
      ageRisk: 'low'
    },
    inspection: {
      lastDate: '2026-01-29',
      daysAgo: 5,
      overdue: false
    },
    pest: { detected: true, active: true, reportedDate: '2026-08-03', type: 'Wax Moth' },
    tags: ['Pest Active'],
    dateEstablished: '2024-09-15'
  },
  {
    _id: 'H-15',
    hiveId: 'H-15',
    name: 'H-15',
    owner: 'demo-user-1',
    status: 'queenless',
    locationType: 'apiary-linked',
    apiary: 'APY-001',
    apiaryName: 'Kegalle Rubber Land',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Swarm capture',
      strength: 30,
      strengthLabel: 'weak'
    },
    queen: {
      present: false
    },
    inspection: {
      lastDate: '2026-01-31',
      daysAgo: 3,
      overdue: false
    },
    pest: { detected: false, active: false },
    tags: ['Needs Inspection'],
    dateEstablished: '2024-03-20'
  },
  {
    _id: 'H-23',
    hiveId: 'H-23',
    name: 'H-23',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'standalone',
    apiaryName: null,
    standaloneLocation: {
      name: 'Home Garden',
      district: 'Colombo',
      gps: { latitude: 6.9271, longitude: 79.8612 }
    },
    hiveType: 'pot',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Bait hive',
      strength: 55,
      strengthLabel: 'normal'
    },
    queen: {
      present: true,
      age: 0.8,
      ageRisk: 'low'
    },
    inspection: {
      lastDate: '2026-01-16',
      daysAgo: 18,
      overdue: true
    },
    pest: { detected: false, active: false },
    tags: ['Needs Inspection'],
    dateEstablished: '2025-06-01'
  },
  {
    _id: 'H-31',
    hiveId: 'H-31',
    name: 'H-31',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'apiary-linked',
    apiary: 'APY-001',
    apiaryName: 'Kegalle Rubber Land',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Split',
      strength: 75,
      strengthLabel: 'strong'
    },
    queen: {
      present: true,
      age: 1.9,
      ageRisk: 'medium'
    },
    inspection: {
      lastDate: '2026-01-27',
      daysAgo: 7,
      overdue: false
    },
    pest: { detected: false, active: false },
    tags: [],
    dateEstablished: '2024-07-12'
  },
  {
    _id: 'H-42',
    hiveId: 'H-42',
    name: 'H-42',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'apiary-linked',
    apiary: 'APY-002',
    apiaryName: 'Kurunegala Coconut Plot',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis mellifera',
      origin: 'Purchased',
      strength: 65,
      strengthLabel: 'normal'
    },
    queen: {
      present: true,
      age: 1.5,
      ageRisk: 'medium'
    },
    inspection: {
      lastDate: '2026-01-22',
      daysAgo: 12,
      overdue: false
    },
    pest: { detected: false, active: false },
    tags: [],
    dateEstablished: '2024-11-20'
  },
  {
    _id: 'H-18',
    hiveId: 'H-18',
    name: 'H-18',
    owner: 'demo-user-1',
    status: 'queenless',
    locationType: 'apiary-linked',
    apiary: 'APY-002',
    apiaryName: 'Kurunegala Coconut Plot',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Local capture',
      strength: 25,
      strengthLabel: 'weak'
    },
    queen: {
      present: false
    },
    inspection: {
      lastDate: '2026-02-01',
      daysAgo: 2,
      overdue: false
    },
    pest: { detected: true, active: true, reportedDate: '2026-01-28', type: 'Varroa' },
    tags: ['Pest Active', 'Needs Inspection'],
    dateEstablished: '2024-08-05'
  },
  {
    _id: 'H-27',
    hiveId: 'H-27',
    name: 'H-27',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'standalone',
    apiaryName: null,
    standaloneLocation: {
      name: 'Countryside',
      district: 'Gampaha',
      gps: { latitude: 7.0917, longitude: 79.9997 }
    },
    hiveType: 'log',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Wild capture',
      strength: 50,
      strengthLabel: 'normal'
    },
    queen: {
      present: true,
      age: 2.1,
      ageRisk: 'medium'
    },
    inspection: {
      lastDate: '2026-01-28',
      daysAgo: 6,
      overdue: false
    },
    pest: { detected: false, active: false },
    tags: [],
    dateEstablished: '2023-12-15'
  },
  {
    _id: 'H-05',
    hiveId: 'H-05',
    name: 'H-05',
    owner: 'demo-user-1',
    status: 'active',
    locationType: 'apiary-linked',
    apiary: 'APY-001',
    apiaryName: 'Kegalle Rubber Land',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Split',
      strength: 55,
      strengthLabel: 'normal'
    },
    queen: {
      present: true,
      age: 0.5,
      ageRisk: 'low'
    },
    inspection: {
      lastDate: '2026-01-14',
      daysAgo: 20,
      overdue: true
    },
    pest: { detected: true, active: true, reportedDate: '2026-01-15', type: 'Small Hive Beetle' },
    tags: ['Needs Inspection', 'Pest Active'],
    dateEstablished: '2025-08-01'
  },
  {
    _id: 'H-34',
    hiveId: 'H-34',
    name: 'H-34',
    owner: 'demo-user-1',
    status: 'queenless',
    locationType: 'apiary-linked',
    apiary: 'APY-001',
    apiaryName: 'Kegalle Rubber Land',
    hiveType: 'box',
    colony: {
      beeSpecies: 'Apis cerana',
      origin: 'Swarm capture',
      strength: 20,
      strengthLabel: 'weak'
    },
    queen: {
      present: false
    },
    inspection: {
      lastDate: '2026-01-30',
      daysAgo: 4,
      overdue: false
    },
    pest: { detected: false, active: false },
    tags: ['Needs Inspection'],
    dateEstablished: '2024-10-10'
  }
];

// @route   GET /api/hives
// @desc    Get all hives
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const hives = demoHives.filter(h => h.owner === req.user._id);
    
    // Calculate summary
    const summary = {
      totalHives: hives.length,
      activeHives: hives.filter(h => h.status === 'active').length,
      apiaryLinkedHives: hives.filter(h => h.locationType === 'apiary-linked').length,
      standaloneHives: hives.filter(h => h.locationType === 'standalone').length,
      queenlessHives: hives.filter(h => h.status === 'queenless' || !h.queen?.present).length,
      pestDetectedHives: hives.filter(h => h.pest?.active).length,
      notInspectedHives: hives.filter(h => h.inspection?.overdue).length
    };

    res.json({
      success: true,
      count: hives.length,
      summary,
      data: hives
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching hives',
      error: error.message
    });
  }
});

// @route   GET /api/hives/:id
// @desc    Get single hive
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const hive = demoHives.find(h => h._id === req.params.id && h.owner === req.user._id);
    
    if (!hive) {
      return res.status(404).json({
        success: false,
        message: 'Hive not found'
      });
    }

    res.json({
      success: true,
      data: hive
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching hive',
      error: error.message
    });
  }
});

// @route   POST /api/hives
// @desc    Create new hive
// @access  Private (Beekeeper only)
router.post('/', protect, authorize('beekeeper'), async (req, res) => {
  try {
    const {
      name,
      locationType,
      apiaryId,
      locationName,
      gpsLatitude,
      gpsLongitude,
      district,
      dateEstablished,
      hiveStatus = 'active',
      hiveType,
      beeSpecies,
      colonyOrigin,
      colonyStrength,
      queenStatus,
      queenIntroductionDate,
      notes
    } = req.body;

    const hiveCount = demoHives.length + 1;
    const newHiveId = `H-${String(hiveCount).padStart(2, '0')}`;

    const newHive = {
      _id: newHiveId,
      hiveId: newHiveId,
      name: name || newHiveId,
      owner: req.user._id,
      status: hiveStatus,
      locationType,
      apiary: locationType === 'apiary-linked' ? apiaryId : null,
      apiaryName: locationType === 'apiary-linked' 
        ? demoHives.find(h => h.apiary === apiaryId)?.apiaryName || 'Unknown Apiary'
        : null,
      standaloneLocation: locationType === 'standalone' ? {
        name: locationName,
        district,
        gps: gpsLatitude && gpsLongitude ? { latitude: gpsLatitude, longitude: gpsLongitude } : null
      } : null,
      hiveType,
      colony: {
        beeSpecies,
        origin: colonyOrigin,
        strength: colonyStrength || 50,
        strengthLabel: colonyStrength <= 33 ? 'weak' : colonyStrength <= 66 ? 'normal' : 'strong'
      },
      queen: {
        present: queenStatus !== 'queenless',
        age: 0,
        ageRisk: 'low',
        introductionDate: queenIntroductionDate
      },
      inspection: {
        lastDate: new Date().toISOString().split('T')[0],
        daysAgo: 0,
        overdue: false
      },
      pest: { detected: false, active: false },
      tags: [],
      notes,
      dateEstablished: dateEstablished || new Date().toISOString()
    };

    demoHives.push(newHive);

    res.status(201).json({
      success: true,
      message: 'Hive created successfully',
      data: newHive
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating hive',
      error: error.message
    });
  }
});

// @route   PUT /api/hives/:id
// @desc    Update hive
// @access  Private (Beekeeper only)
router.put('/:id', protect, authorize('beekeeper'), async (req, res) => {
  try {
    const index = demoHives.findIndex(h => h._id === req.params.id && h.owner === req.user._id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Hive not found'
      });
    }

    demoHives[index] = {
      ...demoHives[index],
      ...req.body,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Hive updated successfully',
      data: demoHives[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating hive',
      error: error.message
    });
  }
});

// @route   DELETE /api/hives/:id
// @desc    Delete hive
// @access  Private (Beekeeper only)
router.delete('/:id', protect, authorize('beekeeper'), async (req, res) => {
  try {
    const index = demoHives.findIndex(h => h._id === req.params.id && h.owner === req.user._id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Hive not found'
      });
    }

    demoHives.splice(index, 1);

    res.json({
      success: true,
      message: 'Hive deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting hive',
      error: error.message
    });
  }
});

// Export demoHives for dashboard route
export { demoHives };
export default router;
