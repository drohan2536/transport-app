const Database = require('better-sqlite3');
const db = new Database('data/transport.db');

// Find Arihant entry
const arihantEntry = db.prepare(`
  SELECT e.*, c.name as client_name 
  FROM entries e 
  JOIN clients c ON e.client_id = c.id 
  WHERE c.name LIKE '%Arihant%' 
  AND e.date = '2026-03-31'
  AND e.to_location LIKE '%Madhuram%'
`).all();

console.log("Arihant entries found:", arihantEntry.length);
if (arihantEntry.length > 0) {
  console.log("Updating Arihant entry id:", arihantEntry[0].id);
  db.prepare('UPDATE entries SET is_paid = 1 WHERE id = ?').run(arihantEntry[0].id);
}

// Find Swarajy entry
const swarajyEntry = db.prepare(`
  SELECT e.*, c.name as client_name 
  FROM entries e 
  JOIN clients c ON e.client_id = c.id 
  WHERE c.name LIKE '%Swarajy%' 
  AND e.date = '2026-04-25'
`).all();

console.log("Swarajy entries found:", swarajyEntry.length);
if (swarajyEntry.length > 0) {
  console.log("Updating Swarajy entry id:", swarajyEntry[0].id);
  db.prepare('UPDATE entries SET is_paid = 1 WHERE id = ?').run(swarajyEntry[0].id);
}

console.log("Done");
