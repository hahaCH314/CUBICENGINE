const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'mmc.db');
try {
  const db = new Database(dbPath);
  const rows = db.prepare("SELECT id, user_id, name, platform, mc_version, updated_at FROM projects").all();
  console.log("PROJECTS:", JSON.stringify(rows, null, 2));
} catch (e) {
  console.error("ERROR:", e);
}
