// Planning routes — R2 Apiary Planning with live weather + zone saturation
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// ─── Forage Data (Sri Lanka ecological zones) ───────────────────────────────
const SRI_LANKA_FORAGE = [
  {
    zone: 'Rubber Zone',
    regions: ['kegalle', 'kalutara', 'ratnapura'],
    plants: [
      { name: 'Rubber Tree', scientific: 'Hevea brasiliensis', resourceType: 'Nectar (extra-floral)', bloomStart: 2, bloomEnd: 3, availability: 'high', note: 'Peak sap period ~20 days. Requires sunshine.' },
    ],
  },
  {
    zone: 'Coconut Zone',
    regions: ['kurunegala', 'gampaha', 'puttalam', 'colombo'],
    plants: [
      { name: 'Coconut Palm', scientific: 'Cocos nucifera', resourceType: 'Pollen', bloomStart: 1, bloomEnd: 12, availability: 'high', note: 'Year-round abundant pollen source.' },
    ],
  },
  {
    zone: 'Eucalyptus / Highland',
    regions: ['diyatalawa', 'haputale', 'bandarawela', 'welimada', 'badulla', 'nuwara eliya'],
    plants: [
      { name: 'Eucalyptus / Red Gum', scientific: 'Eucalyptus spp.', resourceType: 'Nectar', bloomStart: 8, bloomEnd: 9, availability: 'high', note: 'Prolific nectar source in highlands.' },
    ],
  },
  {
    zone: 'Dry Zone Forest',
    regions: ['monaragala', 'buttala', 'anuradhapura', 'polonnaruwa', 'vavuniya', 'mannar', 'hambantota', 'ampara'],
    plants: [
      { name: 'Palu', scientific: 'Manilkara hexandra', resourceType: 'Nectar', bloomStart: 6, bloomEnd: 8, availability: 'high', note: 'Primary dry-zone honey tree.' },
      { name: 'Weera', scientific: 'Drypetes sepiaria', resourceType: 'Nectar', bloomStart: 6, bloomEnd: 8, availability: 'medium', note: '' },
      { name: 'Neem / Kohomba', scientific: 'Azadirachta indica', resourceType: 'Nectar', bloomStart: 2, bloomEnd: 3, availability: 'medium', note: 'Medicinal honey.' },
      { name: 'Tamarind / Siyambala', scientific: 'Tamarindus indica', resourceType: 'Nectar', bloomStart: 2, bloomEnd: 3, availability: 'medium', note: 'Traditional medicinal honey source.' },
    ],
  },
  {
    zone: 'General / Widespread',
    regions: ['*'],
    plants: [
      { name: 'Wild Sunflower', scientific: 'Tithonia diversifolia', resourceType: 'Nectar & Pollen', bloomStart: 1, bloomEnd: 4, availability: 'medium', note: 'Common roadside forage.' },
      { name: 'Mango', scientific: 'Mangifera indica', resourceType: 'Nectar & Pollen', bloomStart: 3, bloomEnd: 5, availability: 'medium', note: '' },
      { name: 'Jak / Kos', scientific: 'Artocarpus heterophyllus', resourceType: 'Pollen', bloomStart: 1, bloomEnd: 12, availability: 'low', note: '' },
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Haversine formula — returns distance in km between two lat/lng points.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Determine temperature risk category for bees.
 */
function getTempRisk(maxTemp) {
  if (maxTemp >= 36) return { level: 'critical', label: 'Critical Risk', color: 'red', detail: 'Potential larval damage & absconding risk' };
  if (maxTemp >= 35) return { level: 'high', label: 'High Risk', color: 'red', detail: 'Foraging drops drastically; bees thermoregulate' };
  if (maxTemp >= 34) return { level: 'stress', label: 'Onset of Stress', color: 'amber', detail: 'Foraging efficiency begins to decrease' };
  if (maxTemp >= 26) return { level: 'optimal', label: 'Optimal Foraging', color: 'green', detail: 'Peak activity 08:30–10:30' };
  return { level: 'cool', label: 'Cool', color: 'blue', detail: 'Below optimal foraging temperature' };
}

/**
 * Determine humidity risk.
 */
function getHumidityStatus(rh) {
  if (rh > 95) return { level: 'risky', label: 'High Risk', color: 'red' };
  if (rh >= 70 && rh <= 79) return { level: 'ideal', label: 'Ideal Foraging', color: 'green' };
  if (rh >= 60 && rh <= 95) return { level: 'safe', label: 'Safe Range', color: 'green' };
  return { level: 'low', label: 'Low Humidity', color: 'amber' };
}

/**
 * Determine rainfall risk (mm/h threshold: rain > 0 for 2+ hours = stop threshold).
 */
function getRainStatus(precipMm) {
  if (precipMm >= 10) return { level: 'high', label: 'Heavy Rain', color: 'red' };
  if (precipMm >= 2) return { level: 'medium', label: 'Moderate Rain', color: 'amber' };
  if (precipMm > 0) return { level: 'light', label: 'Light Rain', color: 'blue' };
  return { level: 'none', label: 'No Rain', color: 'green' };
}

/**
 * Get forage plants for a given district and current month.
 */
function getForageForLocation(district, month) {
  const districtLower = (district || '').toLowerCase();
  const currentPlants = [];
  const upcomingPlants = [];
  const nextMonth = (month % 12) + 1;
  const nextNextMonth = (nextMonth % 12) + 1;

  for (const zone of SRI_LANKA_FORAGE) {
    const matchesRegion =
      zone.regions.includes('*') ||
      zone.regions.some((r) => districtLower.includes(r) || r.includes(districtLower));

    if (!matchesRegion && zone.regions[0] !== '*') continue;

    for (const plant of zone.plants) {
      const isCurrent =
        plant.bloomStart <= plant.bloomEnd
          ? month >= plant.bloomStart && month <= plant.bloomEnd
          : month >= plant.bloomStart || month <= plant.bloomEnd;

      const isUpcoming =
        !isCurrent &&
        (plant.bloomStart === nextMonth || plant.bloomStart === nextNextMonth);

      if (isCurrent) {
        currentPlants.push({ ...plant, zone: zone.zone });
      } else if (isUpcoming) {
        upcomingPlants.push({ ...plant, zone: zone.zone });
      }
    }
  }

  // Always include general plants
  for (const zone of SRI_LANKA_FORAGE.filter((z) => z.regions[0] === '*')) {
    for (const plant of zone.plants) {
      const isCurrent =
        plant.bloomStart <= plant.bloomEnd
          ? month >= plant.bloomStart && month <= plant.bloomEnd
          : month >= plant.bloomStart || month <= plant.bloomEnd;
      if (isCurrent && !currentPlants.find((p) => p.name === plant.name)) {
        currentPlants.push({ ...plant, zone: zone.zone });
      }
    }
  }

  return { current: currentPlants, upcoming: upcomingPlants };
}

// ─── Route: POST /api/planning/analyze ──────────────────────────────────────
// Body: { lat, lng, district? }
// Fetches live weather from Open-Meteo (free, no API key required) and
// counts registered hives within 15 km radius.
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, district } = req.body;

    if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude are required',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // ── 1. Fetch live weather from Open-Meteo (free, no key) ──────────────
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max` +
      `&hourly=temperature_2m,precipitation,relativehumidity_2m,windspeed_10m,weathercode` +
      `&forecast_days=14` +
      `&timezone=Asia%2FColombo`;

    let weatherData = null;
    try {
      const weatherRes = await fetch(weatherUrl);
      if (weatherRes.ok) {
        weatherData = await weatherRes.json();
      }
    } catch (weatherErr) {
      console.warn('Weather fetch failed (non-fatal):', weatherErr.message);
    }

    // ── 2. Zone saturation: count hives within 15km ────────────────────────
    const allHives = db.prepare(`
      SELECT h.id, a.area as location, a.district as district
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
    `).all();

    // Also get apiaries with stored coordinates (if we add them later)
    // For now, use district matching as a proxy for nearby hives
    const nearbyDistricts = [district, ...(district ? [district.toLowerCase()] : [])].filter(Boolean);

    // Count hives in same district as an approximation (since hives don't store lat/lng yet)
    // If we ever store lat/lng on hives/apiaries, we switch to haversine. For now, same district = nearby.
    const sameDistrictHives = allHives.filter(h => {
      if (!h.district) return false;
      return h.district.toLowerCase().includes((district || '').toLowerCase()) ||
             (district || '').toLowerCase().includes(h.district.toLowerCase());
    }).length;

    // Total hives in system for context
    const totalHives = allHives.length;

    // ── 3. Determine saturation level ─────────────────────────────────────
    const saturationCount = sameDistrictHives;
    const saturationLevel =
      saturationCount < 20 ? 'low' : saturationCount < 50 ? 'medium' : 'high';
    const saturationMessage =
      saturationLevel === 'low'
        ? 'Good location — low competition for forage resources.'
        : saturationLevel === 'medium'
        ? 'Moderate hive density — monitor honey yields closely.'
        : 'High saturation — consider a different location to reduce forage competition.';

    // ── 4. Process daily weather into structured days ──────────────────────
    const currentMonth = new Date().getMonth() + 1;
    let processedDays = [];

    if (weatherData && weatherData.daily) {
      const d = weatherData.daily;
      processedDays = d.time.map((dateStr, i) => {
        const maxTemp = d.temperature_2m_max[i];
        const minTemp = d.temperature_2m_min[i];
        const precipMm = d.precipitation_sum[i] || 0;
        const wcode = d.weathercode[i];
        const tempRisk = getTempRisk(maxTemp);
        const rainStatus = getRainStatus(precipMm);

        // Weather code: 0=clear, 1-3=cloudy, 51-67/80-82=rain, 71-77=snow, 95+=storm
        const icon =
          wcode === 0 ? 'sun'
          : wcode <= 3 ? 'cloud'
          : wcode >= 51 ? 'rain'
          : 'cloud';

        const date = new Date(dateStr);
        return {
          date: dateStr,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: date.getDate(),
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          icon,
          maxTemp: Math.round(maxTemp),
          minTemp: Math.round(minTemp),
          precipMm: Math.round(precipMm * 10) / 10,
          tempRisk,
          rainStatus,
          windspeed: d.windspeed_10m_max ? Math.round(d.windspeed_10m_max[i]) : null,
        };
      });
    }

    // ── 5. Process hourly weather for today ───────────────────────────────
    let processedHourly = [];
    if (weatherData && weatherData.hourly) {
      const h = weatherData.hourly;
      // Get today's date string
      const todayStr = new Date().toISOString().split('T')[0];
      h.time.forEach((timeStr, i) => {
        if (timeStr.startsWith(todayStr)) {
          const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
          // Only show daytime hours 5am-9pm
          if (hour >= 5 && hour <= 21 && hour % 2 === 0) {
            const rh = h.relativehumidity_2m[i];
            processedHourly.push({
              time: timeStr.split('T')[1].substring(0, 5),
              temp: Math.round(h.temperature_2m[i]),
              precip: h.precipitation[i] || 0,
              humidity: rh,
              wind: Math.round(h.windspeed_10m[i]),
              wcode: h.weathercode[i],
              tempRisk: getTempRisk(h.temperature_2m[i]),
              humidityStatus: getHumidityStatus(rh),
            });
          }
        }
      });
    }

    // ── 6. Forage data for this location ──────────────────────────────────
    const forage = getForageForLocation(district, currentMonth);

    // ── 7. Overall suitability score (0–100) ─────────────────────────────
    let score = 70; // base
    if (saturationLevel === 'low') score += 15;
    else if (saturationLevel === 'medium') score -= 10;
    else score -= 25;
    if (forage.current.length > 0) score += 10;
    if (forage.current.some((p) => p.availability === 'high')) score += 5;

    score = Math.max(0, Math.min(100, score));
    const suitabilityLabel =
      score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
    const suitabilityColor =
      score >= 80 ? 'green' : score >= 65 ? 'emerald' : score >= 50 ? 'amber' : 'red';

    res.json({
      success: true,
      data: {
        location: { lat: latitude, lng: longitude, district: district || 'Unknown' },
        saturation: {
          count: saturationCount,
          totalInSystem: totalHives,
          level: saturationLevel,
          message: saturationMessage,
          radiusKm: 15,
        },
        suitability: { score, label: suitabilityLabel, color: suitabilityColor },
        weather: {
          days: processedDays,
          hourly: processedHourly,
          source: weatherData ? 'Open-Meteo' : 'unavailable',
        },
        forage: {
          current: forage.current,
          upcoming: forage.upcoming,
          month: currentMonth,
        },
      },
    });
  } catch (error) {
    console.error('Planning analyze error:', error);
    res.status(500).json({ success: false, message: 'Server error during planning analysis' });
  }
});

// ─── Route: GET /api/planning/districts ─────────────────────────────────────
// Returns list of Sri Lanka districts with lat/lng for quick selection
router.get('/districts', authenticateToken, (_req, res) => {
  const districts = [
    { name: 'Ampara', lat: 7.3018, lng: 81.6747 },
    { name: 'Anuradhapura', lat: 8.3114, lng: 80.4037 },
    { name: 'Badulla', lat: 6.9934, lng: 81.0550 },
    { name: 'Batticaloa', lat: 7.7310, lng: 81.6747 },
    { name: 'Colombo', lat: 6.9271, lng: 79.8612 },
    { name: 'Galle', lat: 6.0535, lng: 80.2210 },
    { name: 'Gampaha', lat: 7.0873, lng: 80.0144 },
    { name: 'Hambantota', lat: 6.1241, lng: 81.1185 },
    { name: 'Jaffna', lat: 9.6615, lng: 80.0255 },
    { name: 'Kalutara', lat: 6.5854, lng: 79.9607 },
    { name: 'Kandy', lat: 7.2906, lng: 80.6337 },
    { name: 'Kegalle', lat: 7.2513, lng: 80.3464 },
    { name: 'Kilinochchi', lat: 9.3803, lng: 80.3770 },
    { name: 'Kurunegala', lat: 7.4860, lng: 80.3609 },
    { name: 'Mannar', lat: 8.9771, lng: 79.9037 },
    { name: 'Matale', lat: 7.4675, lng: 80.6234 },
    { name: 'Matara', lat: 5.9549, lng: 80.5550 },
    { name: 'Monaragala', lat: 6.8728, lng: 81.3507 },
    { name: 'Mullativu', lat: 9.2671, lng: 80.8138 },
    { name: 'Nuwara Eliya', lat: 6.9497, lng: 80.7891 },
    { name: 'Polonnaruwa', lat: 7.9403, lng: 81.0188 },
    { name: 'Puttalam', lat: 8.0362, lng: 79.8283 },
    { name: 'Ratnapura', lat: 6.7056, lng: 80.3847 },
    { name: 'Trincomalee', lat: 8.5922, lng: 81.2152 },
    { name: 'Vavuniya', lat: 8.7542, lng: 80.4982 },
  ];
  res.json({ success: true, data: { districts } });
});

export default router;
