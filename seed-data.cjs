// Seed script: creates sample admin, helper, apiaries, hives, inspections, harvests, expenses, feedings, treatments, queens, components, assignments
// Run with: node seed-data.cjs
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const newSystemRoot = path.resolve(__dirname, '..');
const dbPath = path.resolve(newSystemRoot, 'database/apicore.db');
const schemaPath = path.resolve(newSystemRoot, 'database/schema.sql');

// Ensure DB dir exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Init schema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Run migrations
try {
  const cols = db.pragma('table_info(hives)');
  if (!cols.find(c => c.name === 'is_starred')) db.exec("ALTER TABLE hives ADD COLUMN is_starred BOOLEAN DEFAULT 0");
  if (!cols.find(c => c.name === 'is_flagged')) db.exec("ALTER TABLE hives ADD COLUMN is_flagged BOOLEAN DEFAULT 0");
  if (!cols.find(c => c.name === 'flag_reason')) db.exec("ALTER TABLE hives ADD COLUMN flag_reason TEXT");
} catch (e) { /* ok */ }

console.log('🌱 Seeding sample data...\n');

// ── USERS ──────────────────────────────────────────────────────
const adminPw = bcrypt.hashSync('admin123', 10);
const helperPw = bcrypt.hashSync('helper123', 10);

// Check if admin exists
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = 'amal@apicore.lk'").get();
if (existingAdmin) {
  console.log('⚠  Data already seeded (admin user exists). Skipping to avoid duplicates.');
  process.exit(0);
}

const admin = db.prepare(`
  INSERT INTO users (name, email, password, phone, district, role, years_experience)
  VALUES ('Amal Perera', 'amal@apicore.lk', ?, '+94 77 456 7890', 'Kandy', 'beekeeper', 8)
`).run(adminPw);
const adminId = admin.lastInsertRowid;

const helper1 = db.prepare(`
  INSERT INTO users (name, email, password, phone, district, role, years_experience)
  VALUES ('Kasun Silva', 'kasun@apicore.lk', ?, '+94 71 234 5678', 'Kandy', 'helper', 2)
`).run(helperPw);
const helper1Id = helper1.lastInsertRowid;

const helper2 = db.prepare(`
  INSERT INTO users (name, email, password, phone, district, role, years_experience)
  VALUES ('Nimal Jayawardena', 'nimal@apicore.lk', ?, '+94 76 987 6543', 'Matale', 'helper', 1)
`).run(helperPw);
const helper2Id = helper2.lastInsertRowid;

console.log(`✓ Created admin: amal@apicore.lk / admin123`);
console.log(`✓ Created helper: kasun@apicore.lk / helper123`);
console.log(`✓ Created helper: nimal@apicore.lk / helper123`);

// ── INVITATIONS (one accepted, one pending) ───────────────────
db.prepare(`
  INSERT INTO helper_invitations (invited_by, email, token, status, created_at, accepted_at)
  VALUES (?, 'kasun@apicore.lk', 'ABCD1234', 'accepted', datetime('now', '-30 days'), datetime('now', '-29 days'))
`).run(adminId);

db.prepare(`
  INSERT INTO helper_invitations (invited_by, email, token, status, expires_at)
  VALUES (?, 'dilan@example.com', 'EFGH5678', 'pending', datetime('now', '+7 days'))
`).run(adminId);

console.log('✓ Created invitations (1 accepted, 1 pending)');

// ── APIARIES ──────────────────────────────────────────────────
const a1 = db.prepare(`
  INSERT INTO apiaries (user_id, name, district, area, established_date, status, apiary_type, terrain, forage_primary, blooming_window)
  VALUES (?, 'Kandy Hills Apiary', 'Kandy', 'Hantana Road, Kandy', '2023-03-15', 'active', 'personal', 'hilly', 'Cinnamon, Rubber', 'March - June')
`).run(adminId).lastInsertRowid;

const a2 = db.prepare(`
  INSERT INTO apiaries (user_id, name, district, area, established_date, status, apiary_type, terrain, forage_primary, blooming_window)
  VALUES (?, 'Matale Valley Farm', 'Matale', 'Dambulla Road, Matale', '2024-01-10', 'active', 'personal', 'flat', 'Coconut, Wildflowers', 'January - April')
`).run(adminId).lastInsertRowid;

const a3 = db.prepare(`
  INSERT INTO apiaries (user_id, name, district, area, established_date, status, apiary_type, terrain, forage_primary, blooming_window)
  VALUES (?, 'Peradeniya Garden Site', 'Kandy', 'Royal Botanical Gardens area', '2024-06-01', 'active', 'client', 'flat', 'Mixed tropical flora', 'Year-round')
`).run(adminId).lastInsertRowid;

console.log('✓ Created 3 apiaries');

// ── APIARY HISTORY ────────────────────────────────────────────
db.prepare(`INSERT INTO apiary_history (apiary_id, user_id, action, details, created_at) VALUES (?, ?, 'created', 'Apiary "Kandy Hills Apiary" created in Kandy', datetime('now', '-300 days'))`).run(a1, adminId);
db.prepare(`INSERT INTO apiary_history (apiary_id, user_id, action, details, created_at) VALUES (?, ?, 'created', 'Apiary "Matale Valley Farm" created in Matale', datetime('now', '-200 days'))`).run(a2, adminId);
db.prepare(`INSERT INTO apiary_history (apiary_id, user_id, action, details, created_at) VALUES (?, ?, 'created', 'Apiary "Peradeniya Garden Site" created in Kandy', datetime('now', '-100 days'))`).run(a3, adminId);

// ── HIVES ─────────────────────────────────────────────────────
const hiveInsert = db.prepare(`
  INSERT INTO hives (user_id, apiary_id, name, hive_type, location_type, status, queen_present, queen_age, queen_age_risk, colony_strength, last_inspection_date, inspection_overdue, pest_detected, is_starred)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const h1 = hiveInsert.run(adminId, a1, 'KH-001', 'box', 'apiary-linked', 'active', 1, 1.2, 'low', 'strong', '2026-02-10', 0, 0, 1).lastInsertRowid;
const h2 = hiveInsert.run(adminId, a1, 'KH-002', 'box', 'apiary-linked', 'active', 1, 2.5, 'medium', 'normal', '2026-01-28', 1, 0, 0).lastInsertRowid;
const h3 = hiveInsert.run(adminId, a1, 'KH-003', 'pot', 'apiary-linked', 'queenless', 0, null, null, 'weak', '2026-02-01', 1, 1, 0).lastInsertRowid;
const h4 = hiveInsert.run(adminId, a2, 'MV-001', 'box', 'apiary-linked', 'active', 1, 0.5, 'low', 'strong', '2026-02-15', 0, 0, 0).lastInsertRowid;
const h5 = hiveInsert.run(adminId, a2, 'MV-002', 'log', 'apiary-linked', 'active', 1, 1.8, 'low', 'normal', '2026-02-12', 0, 0, 0).lastInsertRowid;
const h6 = hiveInsert.run(adminId, a3, 'PG-001', 'box', 'apiary-linked', 'active', 1, 0.3, 'low', 'strong', '2026-02-17', 0, 0, 1).lastInsertRowid;
const h7 = hiveInsert.run(adminId, a3, 'PG-002', 'box', 'apiary-linked', 'active', 1, 3.0, 'high', 'normal', '2026-01-20', 1, 0, 0).lastInsertRowid;
const h8 = hiveInsert.run(adminId, null, 'SH-001', 'pot', 'standalone', 'active', 1, 1.0, 'low', 'normal', '2026-02-05', 0, 0, 0).lastInsertRowid;

console.log('✓ Created 8 hives across 3 apiaries + 1 standalone');

// ── INSPECTIONS ───────────────────────────────────────────────
const inspInsert = db.prepare(`
  INSERT INTO inspections (user_id, hive_id, apiary_id, inspection_date, queen_present, colony_strength, pest_detected, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

inspInsert.run(adminId, h1, a1, '2026-02-10', 1, 'strong', 0, 'Healthy colony, good brood pattern. 7 frames of brood.');
inspInsert.run(adminId, h1, a1, '2026-01-15', 1, 'strong', 0, 'Winter cluster looks good, plenty of stores.');
inspInsert.run(adminId, h2, a1, '2026-01-28', 1, 'normal', 0, 'Queen spotted on frame 4. Some drone cells visible.');
inspInsert.run(adminId, h3, a1, '2026-02-01', 0, 'weak', 1, 'No queen found. Wax moth signs on bottom board. Need treatment.');
inspInsert.run(helper1Id, h4, a2, '2026-02-15', 1, 'strong', 0, 'Very productive colony. Heavy with honey.');
inspInsert.run(adminId, h5, a2, '2026-02-12', 1, 'normal', 0, 'Log hive doing well. Natural comb building nicely.');
inspInsert.run(adminId, h6, a3, '2026-02-17', 1, 'strong', 0, 'Client hive thriving. Good forage availability.');
inspInsert.run(adminId, h7, a3, '2026-01-20', 1, 'normal', 0, 'Queen aging - consider replacement in next season.');

console.log('✓ Created 8 inspections');

// ── HARVESTS ──────────────────────────────────────────────────
const harvInsert = db.prepare(`
  INSERT INTO harvests (user_id, hive_id, apiary_id, harvest_date, harvest_type, quantity, unit, quality, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

harvInsert.run(adminId, h1, a1, '2026-01-20', 'honey', 4.5, 'kg', 'premium', 'First harvest of the year. Light amber color.');
harvInsert.run(adminId, h1, a1, '2025-11-15', 'honey', 6.2, 'kg', 'standard', 'Late season harvest. Dark amber.');
harvInsert.run(adminId, h2, a1, '2026-01-25', 'honey', 3.0, 'kg', 'standard', 'Moderate yield due to weather.');
harvInsert.run(adminId, h4, a2, '2026-02-10', 'honey', 5.8, 'kg', 'premium', 'Coconut blossom honey. Excellent quality.');
harvInsert.run(adminId, h4, a2, '2025-12-05', 'beeswax', 0.8, 'kg', 'standard', 'Recovered from old combs.');
harvInsert.run(adminId, h6, a3, '2026-02-14', 'honey', 7.1, 'kg', 'organic', 'Botanical garden flora honey. Client very happy.');
harvInsert.run(adminId, h5, a2, '2026-01-30', 'honey', 2.5, 'kg', 'standard', 'Log hive natural harvest.');

console.log('✓ Created 7 harvests');

// ── EXPENSES ──────────────────────────────────────────────────
const expInsert = db.prepare(`
  INSERT INTO expenses (user_id, hive_id, apiary_id, expense_date, expense_type, amount, description, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

expInsert.run(adminId, h1, a1, '2026-01-05', 'equipment', 3500, 'New frames (10 pcs)', 'Deep frames for KH-001');
expInsert.run(adminId, null, a1, '2026-01-10', 'feed', 1200, 'Sugar (25kg bag)', 'For winter supplemental feeding');
expInsert.run(adminId, h3, a1, '2026-02-02', 'medication', 2800, 'Wax moth treatment strips', 'B402 treatment for KH-003');
expInsert.run(adminId, null, a2, '2025-12-20', 'transport', 5000, 'Vehicle hire for hive transport', 'Moving 2 colonies to Matale');
expInsert.run(adminId, h6, a3, '2026-02-01', 'maintenance', 1500, 'Hive stand repair', 'Replaced rotted wood stand');
expInsert.run(adminId, null, null, '2026-01-15', 'equipment', 8500, 'Bee suit and gloves', 'New protective gear for helper');

console.log('✓ Created 6 expenses');

// ── INCOME ────────────────────────────────────────────────────
const incInsert = db.prepare(`
  INSERT INTO income (user_id, income_date, income_type, amount, buyer_name, description)
  VALUES (?, ?, ?, ?, ?, ?)
`);

incInsert.run(adminId, '2026-01-22', 'honey_sale', 9000, 'Lanka Organics', 'Premium honey 4.5kg @ Rs. 2000/kg');
incInsert.run(adminId, '2026-02-12', 'honey_sale', 11600, 'Kandy Market', 'Coconut honey 5.8kg @ Rs. 2000/kg');
incInsert.run(adminId, '2026-02-16', 'honey_sale', 21300, 'Hotel Botanical', 'Botanical honey 7.1kg @ Rs. 3000/kg (client premium)');
incInsert.run(adminId, '2025-12-10', 'wax_sale', 2400, 'Craft Shop Kandy', 'Beeswax 0.8kg');

console.log('✓ Created 4 income records');

// ── FEEDINGS ──────────────────────────────────────────────────
const feedInsert = db.prepare(`
  INSERT INTO feedings (user_id, hive_id, feeding_date, feed_type, quantity, unit, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

feedInsert.run(adminId, h2, '2026-02-05', 'sugar_syrup', 500, 'ml', 'Light syrup 1:1 ratio');
feedInsert.run(adminId, h3, '2026-02-03', 'sugar_syrup', 750, 'ml', 'Heavy syrup 2:1 for weak colony');
feedInsert.run(adminId, h3, '2026-02-10', 'pollen_patty', 200, 'g', 'Protein supplement for recovery');
feedInsert.run(helper1Id, h4, '2026-02-08', 'sugar_syrup', 500, 'ml', 'Routine supplemental feeding');

console.log('✓ Created 4 feedings');

// ── TREATMENTS ────────────────────────────────────────────────
const treatInsert = db.prepare(`
  INSERT INTO treatments (user_id, hive_id, treatment_date, treatment_type, product_name, dosage, application_method, duration_days, outcome, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

treatInsert.run(adminId, h3, '2026-02-02', 'wax_moth', 'Certan B402', '2 strips', 'strips', 14, 'ongoing', 'Applied strips between frames 3 and 7');
treatInsert.run(adminId, h1, '2025-12-01', 'varroa', 'Apivar', '2 strips', 'strips', 42, 'effective', 'Varroa count dropped from 6 to 0.5 per 100 bees');
treatInsert.run(adminId, h7, '2026-01-15', 'varroa', 'Oxalic Acid', '5ml/frame', 'drench', 1, 'effective', 'Broodless period treatment');

console.log('✓ Created 3 treatments');

// ── QUEENS ────────────────────────────────────────────────────
const queenInsert = db.prepare(`
  INSERT INTO queens (user_id, hive_id, marking_color, source, introduction_date, status, species, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

queenInsert.run(adminId, h1, 'blue', 'purchased', '2025-01-15', 'active', 'apis_cerana', 'Italian queen, very gentle. Good layer.');
queenInsert.run(adminId, h2, 'yellow', 'reared', '2023-09-10', 'active', 'apis_cerana', 'Self-reared from best genetics.');
queenInsert.run(adminId, h4, 'white', 'purchased', '2025-08-20', 'active', 'apis_cerana', 'Young queen, excellent brood pattern.');
queenInsert.run(adminId, h5, 'unmarked', 'swarm', '2025-04-01', 'active', 'apis_cerana', 'Captured swarm queen.');
queenInsert.run(adminId, h6, 'green', 'purchased', '2025-10-01', 'active', 'apis_cerana', 'Premium queen for client hive.');
queenInsert.run(adminId, h7, 'red', 'reared', '2023-02-15', 'active', 'apis_cerana', 'Aging queen - replacement planned.');

console.log('✓ Created 6 queen records');

// ── COMPONENTS ────────────────────────────────────────────────
const compInsert = db.prepare(`
  INSERT INTO hive_components (user_id, hive_id, component_type, quantity, condition, installed_date, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

compInsert.run(adminId, h1, 'frame', 10, 'good', '2025-01-15', 'Deep frames with foundation');
compInsert.run(adminId, h1, 'super', 2, 'good', '2025-06-01', 'Honey supers added for flow season');
compInsert.run(adminId, h1, 'queen_excluder', 1, 'good', '2025-06-01', 'Metal queen excluder');
compInsert.run(adminId, h2, 'frame', 8, 'fair', '2023-09-10', 'Some frames need replacement');
compInsert.run(adminId, h4, 'frame', 10, 'new', '2025-08-20', 'Fresh frames with new foundation');
compInsert.run(adminId, h4, 'feeder', 1, 'good', '2025-08-20', 'Top feeder installed');
compInsert.run(adminId, h6, 'frame', 10, 'good', '2025-10-01', 'Client hive standard setup');
compInsert.run(adminId, h6, 'super', 1, 'good', '2026-01-15', 'Added super for honey flow');

console.log('✓ Created 8 component records');

// ── ALERTS ────────────────────────────────────────────────────
const alertInsert = db.prepare(`
  INSERT INTO alerts (user_id, hive_id, apiary_id, alert_type, message, is_read, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

alertInsert.run(adminId, h3, a1, 'critical', 'Hive KH-003 is queenless — colony at risk', 0, new Date().toISOString());
alertInsert.run(adminId, h3, a1, 'warning', 'Wax moth detected in KH-003 — treatment applied', 1, new Date(Date.now() - 86400000 * 2).toISOString());
alertInsert.run(adminId, h2, a1, 'warning', 'Inspection overdue for KH-002 (last: Jan 28)', 0, new Date().toISOString());
alertInsert.run(adminId, h7, a3, 'info', 'Queen in PG-002 is 3 years old — consider replacement', 0, new Date().toISOString());
alertInsert.run(adminId, h7, a3, 'warning', 'Inspection overdue for PG-002 (last: Jan 20)', 0, new Date().toISOString());

console.log('✓ Created 5 alerts');

// ── HIVE ASSIGNMENTS (R8) ─────────────────────────────────────
const assignInsert = db.prepare(`
  INSERT INTO hive_assignments (hive_id, helper_id, assigned_by, notes)
  VALUES (?, ?, ?, ?)
`);

// Kasun is assigned to Kandy Hills hives + one Matale hive
assignInsert.run(h1, helper1Id, adminId, 'Primary keeper for KH-001');
assignInsert.run(h2, helper1Id, adminId, 'Primary keeper for KH-002');
assignInsert.run(h3, helper1Id, adminId, 'Monitor queenless hive closely');
assignInsert.run(h4, helper1Id, adminId, 'Assigned during Matale visit');

// Nimal is assigned to Peradeniya hives
assignInsert.run(h6, helper2Id, adminId, 'Client hive caretaker');
assignInsert.run(h7, helper2Id, adminId, 'Client hive caretaker');

console.log('✓ Created 6 hive assignments (Kasun: 4 hives, Nimal: 2 hives)');

console.log('\n🎉 Seed complete!\n');
console.log('─────────────────────────────────────');
console.log('  Admin login:  amal@apicore.lk / admin123');
console.log('  Helper login: kasun@apicore.lk / helper123');
console.log('  Helper login: nimal@apicore.lk / helper123');
console.log('  Pending invite token: EFGH5678');
console.log('─────────────────────────────────────\n');

db.close();
process.exit(0);
