import express from 'express';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Demo apiaries data
const demoApiaries = [
  {
    _id: 'APY-001',
    name: 'Kegalle Rubber Land',
    status: 'expired',
    owner: 'demo-user-1',
    establishedDate: '2023-03-12',
    location: {
      name: 'Kegalle Rubber Land',
      district: 'Kegalle',
      area: 'Rambukkana',
      gps: { latitude: 7.3235, longitude: 80.3847 }
    },
    apiaryType: 'client',
    forage: {
      types: ['Rubber'],
      primary: 'Rubber Flow',
      bloomingPeriod: 'Feb – Mar'
    },
    weather: {
      temp: 29,
      condition: 'cloudy',
      forecast: ['cloudy', 'sunny', 'cloudy', 'rainy', 'sunny']
    },
    hiveCount: 12,
    queenlessHiveCount: 2
  },
  {
    _id: 'APY-002',
    name: 'Kurunegala Coconut Plot',
    status: 'active',
    owner: 'demo-user-1',
    establishedDate: '2024-01-08',
    location: {
      name: 'Kurunegala Coconut Plot',
      district: 'Kurunegala',
      area: 'Polgahawela',
      gps: { latitude: 7.4675, longitude: 80.2983 }
    },
    apiaryType: 'personal',
    forage: {
      types: ['Coconut'],
      primary: 'Coconut Bloom',
      bloomingPeriod: 'Year-round'
    },
    weather: {
      temp: 31,
      condition: 'sunny',
      forecast: ['sunny', 'sunny', 'cloudy', 'sunny', 'cloudy']
    },
    hiveCount: 18,
    queenlessHiveCount: 0
  },
  {
    _id: 'APY-003',
    name: 'Kandy Eucalyptus Zone',
    status: 'active',
    owner: 'demo-user-1',
    establishedDate: '2023-09-22',
    location: {
      name: 'Kandy Eucalyptus Zone',
      district: 'Kandy',
      area: 'Peradeniya',
      gps: { latitude: 7.2675, longitude: 80.5983 }
    },
    apiaryType: 'personal',
    forage: {
      types: ['Eucalyptus'],
      primary: 'Eucalyptus',
      bloomingPeriod: 'Jun – Aug'
    },
    weather: {
      temp: 27,
      condition: 'cloudy',
      forecast: ['rainy', 'rainy', 'cloudy', 'cloudy', 'sunny']
    },
    hiveCount: 8,
    queenlessHiveCount: 1
  },
  {
    _id: 'APY-004',
    name: 'Gampaha Home Garden',
    status: 'active',
    owner: 'demo-user-1',
    establishedDate: '2024-11-15',
    location: {
      name: 'Gampaha Home Garden',
      district: 'Gampaha',
      area: 'Kadawatha',
      gps: { latitude: 6.9934, longitude: 79.9534 }
    },
    apiaryType: 'personal',
    forage: {
      types: ['Mixed Garden'],
      primary: 'Mixed Garden',
      bloomingPeriod: 'Jul – Sep'
    },
    weather: {
      temp: 30,
      condition: 'sunny',
      forecast: ['sunny', 'cloudy', 'sunny', 'sunny', 'cloudy']
    },
    hiveCount: 4,
    queenlessHiveCount: 0
  },
  {
    _id: 'APY-005',
    name: 'Matale Dry Zone Reserve',
    status: 'empty',
    owner: 'demo-user-1',
    establishedDate: '2024-04-03',
    location: {
      name: 'Matale Dry Zone Reserve',
      district: 'Matale',
      area: 'Dambulla',
      gps: { latitude: 7.8742, longitude: 80.6511 }
    },
    apiaryType: 'personal',
    forage: {
      types: ['Dry Zone Forest'],
      primary: 'Dry Zone Forest',
      bloomingPeriod: 'Oct – Dec'
    },
    weather: {
      temp: 33,
      condition: 'sunny',
      forecast: ['sunny', 'sunny', 'sunny', 'cloudy', 'sunny']
    },
    hiveCount: 0,
    queenlessHiveCount: 0
  }
];

// @route   GET /api/apiaries
// @desc    Get all apiaries
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const apiaries = demoApiaries.filter(a => a.owner === req.user._id);
    
    // Calculate summary
    const summary = {
      totalApiaries: apiaries.length,
      apiariesWithHives: apiaries.filter(a => a.hiveCount > 0).length,
      emptyApiaries: apiaries.filter(a => a.status === 'empty').length,
      expiredApiaries: apiaries.filter(a => a.status === 'expired').length
    };

    res.json({
      success: true,
      count: apiaries.length,
      summary,
      data: apiaries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching apiaries',
      error: error.message
    });
  }
});

// @route   GET /api/apiaries/:id
// @desc    Get single apiary
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const apiary = demoApiaries.find(a => a._id === req.params.id && a.owner === req.user._id);
    
    if (!apiary) {
      return res.status(404).json({
        success: false,
        message: 'Apiary not found'
      });
    }

    res.json({
      success: true,
      data: apiary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching apiary',
      error: error.message
    });
  }
});

// @route   POST /api/apiaries
// @desc    Create new apiary
// @access  Private (Beekeeper only)
router.post('/', protect, authorize('beekeeper'), async (req, res) => {
  try {
    const {
      name,
      establishedDate,
      environment,
      terrainType,
      locationName,
      gpsLatitude,
      gpsLongitude,
      district,
      apiaryType,
      ownerName,
      ownerContact,
      contractType,
      contractStartDate,
      contractEndDate,
      forageTypes,
      bloomingPeriod,
      notes,
      status = 'active'
    } = req.body;

    const newApiary = {
      _id: `APY-${Date.now()}`,
      name,
      status,
      owner: req.user._id,
      establishedDate,
      environment,
      terrainType,
      location: {
        name: locationName,
        district,
        gps: gpsLatitude && gpsLongitude ? { latitude: gpsLatitude, longitude: gpsLongitude } : null
      },
      apiaryType,
      clientInfo: apiaryType === 'client' ? {
        ownerName,
        ownerContact,
        contractType,
        contractStartDate,
        contractEndDate
      } : null,
      forage: {
        types: forageTypes || [],
        primary: forageTypes?.[0] || '',
        bloomingPeriod
      },
      notes,
      hiveCount: 0,
      queenlessHiveCount: 0,
      weather: {
        temp: 28,
        condition: 'sunny',
        forecast: ['sunny', 'sunny', 'cloudy', 'sunny', 'cloudy']
      }
    };

    demoApiaries.push(newApiary);

    res.status(201).json({
      success: true,
      message: 'Apiary created successfully',
      data: newApiary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating apiary',
      error: error.message
    });
  }
});

// @route   PUT /api/apiaries/:id
// @desc    Update apiary
// @access  Private (Beekeeper only)
router.put('/:id', protect, authorize('beekeeper'), async (req, res) => {
  try {
    const index = demoApiaries.findIndex(a => a._id === req.params.id && a.owner === req.user._id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Apiary not found'
      });
    }

    demoApiaries[index] = {
      ...demoApiaries[index],
      ...req.body,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Apiary updated successfully',
      data: demoApiaries[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating apiary',
      error: error.message
    });
  }
});

// @route   DELETE /api/apiaries/:id
// @desc    Delete apiary
// @access  Private (Beekeeper only)
router.delete('/:id', protect, authorize('beekeeper'), async (req, res) => {
  try {
    const index = demoApiaries.findIndex(a => a._id === req.params.id && a.owner === req.user._id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Apiary not found'
      });
    }

    demoApiaries.splice(index, 1);

    res.json({
      success: true,
      message: 'Apiary deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting apiary',
      error: error.message
    });
  }
});

export default router;
