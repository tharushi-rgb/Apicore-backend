const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// From backend/src/config go up 3 levels to reach "New System" folder
const newSystemRoot = path.resolve(__dirname, '../../..');
const dbPath = path.resolve(newSystemRoot, 'database/apicore.db');
const schemaPath = path.resolve(newSystemRoot, 'database/schema.sql');

console.log('New System root:', newSystemRoot);
console.log('Database path:', dbPath);
console.log('Schema path:', schemaPath);
console.log('Schema exists?', fs.existsSync(schemaPath));

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Read and execute schema
try {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('✓ Database schema initialized successfully');
} catch (error) {
  console.error('Error initializing database schema:', error.message);
}

// Ensure demo user has hashed password
const ensureDemoUser = () => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    
    if (user && !user.password.startsWith('$2b$')) {
      // Password is not hashed, hash it
      const hashedPassword = bcrypt.hashSync('password123', 10);
      db.prepare('UPDATE users SET password = ? WHERE id = 1').run(hashedPassword);
      console.log('✓ Demo user password hashed');
    }
    
    // Insert some demo data if database is empty
    const apiaryCount = db.prepare('SELECT COUNT(*) as count FROM apiaries').get();
    
    if (apiaryCount.count === 0) {
      const insertApiary = db.prepare(`
        INSERT INTO apiaries (user_id, name, district, area, established_date, status, terrain, forage_primary, blooming_window)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertApiary.run(1, 'Kegalle Rubber Land', 'Kegalle', 'Rambukkana', '2023-03-12', 'active', 'hilly', 'Rubber Flow', 'Feb – Mar');
      insertApiary.run(1, 'Kurunegala Coconut Plot', 'Kurunegala', 'Polgahawela', '2024-01-08', 'active', 'coastal', 'Coconut Bloom', 'Year-round');
      console.log('✓ Demo apiaries created');

      const insertHive = db.prepare(`
        INSERT INTO hives (user_id, apiary_id, name, hive_type, location_type, status, queen_present, queen_age, queen_age_risk, colony_strength, last_inspection_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertHive.run(1, 1, 'H-07', 'box', 'apiary-linked', 'active', 1, 2.7, 'high', 'normal', '2026-01-27');
      insertHive.run(1, 2, 'H-12', 'box', 'apiary-linked', 'active', 1, 1.2, 'low', 'strong', '2026-01-30');
      console.log('✓ Demo hives created');
    }
  } catch (error) {
    console.error('Error setting up demo data:', error.message);
  }
};

ensureDemoUser();

console.log('✓ Connected to SQLite database at', dbPath);

module.exports = db;
