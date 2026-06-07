const Database = require('better-sqlite3');
const db = new Database('data/transport.db');

const swarajyEntry = db.prepare(`
  SELECT e.*, c.name as client_name 
  FROM entries e 
  JOIN clients c ON e.client_id = c.id 
  WHERE c.name LIKE '%Swarajy%' 
  AND e.date = '2026-04-25'
`).all();

console.log("Swarajy entries found:", swarajyEntry.length);
for (const entry of swarajyEntry) {
  console.log("Updating Swarajy entry id:", entry.id);
  db.prepare('UPDATE entries SET is_paid = 1 WHERE id = ?').run(entry.id);
}
console.log("Done");
