import express from 'express';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/dashboard
// @desc    Get dashboard data
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Demo dashboard data based on UI design
    const dashboardData = {
      kpis: {
        totalApiaries: 5,
        totalHives: 42,
        queenlessHives: 3,
        activeClientServices: 2,
        notInspected14Days: 6,
        harvestThisMonth: 18.5
      },
      alerts: [
        { id: 1, type: 'warning', message: 'Hive H-12 marked Pest Activity' },
        { id: 2, type: 'critical', message: "Apiary 'Kegalle Rubber Land' contract expires in 7 days" },
        { id: 3, type: 'critical', message: 'Queen age high risk – Hive H-07' },
        { id: 4, type: 'info', message: 'Monthly inspection reminder for 6 hives' }
      ],
      queenAgeData: {
        low: [
          { hiveId: 'H-15', apiaryName: 'Kegalle Rubber Land', queenAge: 0.8, riskLevel: 'low' },
          { hiveId: 'H-23', apiaryName: 'Kurunegala Coconut Plot', queenAge: 1.2, riskLevel: 'low' },
          { hiveId: 'H-31', apiaryName: 'Kegalle Rubber Land', queenAge: 1.4, riskLevel: 'low' }
        ],
        medium: [
          { hiveId: 'H-12', apiaryName: 'Kurunegala Coconut Plot', queenAge: 1.9, riskLevel: 'medium' },
          { hiveId: 'H-27', apiaryName: 'Kegalle Rubber Land', queenAge: 2.1, riskLevel: 'medium' }
        ],
        high: [
          { hiveId: 'H-07', apiaryName: 'Kegalle Rubber Land', queenAge: 2.8, riskLevel: 'high' },
          { hiveId: 'H-18', apiaryName: 'Kurunegala Coconut Plot', queenAge: 3.1, riskLevel: 'high' },
          { hiveId: 'H-34', apiaryName: 'Kegalle Rubber Land', queenAge: 2.9, riskLevel: 'high' }
        ]
      },
      bestPerformingHives: [
        { hiveId: 'H-15', performance: 12.5 },
        { hiveId: 'H-23', performance: 11.8 },
        { hiveId: 'H-07', performance: 10.2 },
        { hiveId: 'H-31', performance: 9.5 },
        { hiveId: 'H-42', performance: 8.9 }
      ],
      bestPerformingForages: [
        { forage: 'Rubber', yield: 45.2 },
        { forage: 'Coconut', yield: 38.7 },
        { forage: 'Eucalyptus', yield: 28.5 },
        { forage: 'Dry Zone', yield: 22.1 }
      ],
      forageCalendar: {
        current: {
          area: 'Kurunegala',
          plants: [
            { name: 'Coconut', period: 'Year round' },
            { name: 'Banana', period: 'Aug–Oct' },
            { name: 'Home garden flora', period: 'Jul–Sep' }
          ]
        },
        upcoming: {
          area: 'Kurunegala',
          plants: [
            { name: 'Coconut', period: 'Year round' },
            { name: 'Wild sunflower', period: 'Oct–Jan' },
            { name: 'Neem', period: 'Oct–Dec' }
          ]
        }
      },
      topContributor: {
        forage: 'Rubber',
        apiary: 'Kegalle Rubber Land',
        percentage: 62,
        hives: ['H-15', 'H-23', 'H-31'],
        totalYield: 45.2
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/summary
// @desc    Get quick summary for header
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        apiaries: 5,
        hives: 42,
        alertsCount: 4,
        pendingInspections: 6
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching summary',
      error: error.message
    });
  }
});

export default router;
