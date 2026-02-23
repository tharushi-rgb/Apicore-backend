// Database initialisation script (CommonJS)
// Uses centralised config — DB path defined in config/app.cjs
const db = require('./src/config/database.cjs');
console.log('\n✓ Database initialised successfully!');
process.exit(0);
