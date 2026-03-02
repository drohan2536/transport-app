import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'transport.db'));

// Enable WAL mode & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    owner_name TEXT DEFAULT '',
    pan_id TEXT NOT NULL,
    udyam_certificate_path TEXT DEFAULT '',
    abbreviation TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    company_id INTEGER NOT NULL REFERENCES companies(id),
    invoice_visible_columns TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );



  CREATE TABLE IF NOT EXISTS company_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );


  CREATE TABLE IF NOT EXISTS contact_persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    date TEXT NOT NULL,
    from_location TEXT DEFAULT '',
    to_location TEXT DEFAULT '',
    has_challan INTEGER DEFAULT 0,
    challan_number TEXT DEFAULT '',
    has_vehicle INTEGER DEFAULT 0,
    vehicle_number TEXT DEFAULT '',
    entry_type TEXT NOT NULL CHECK(entry_type IN ('per_kg','per_bundle')),
    unit TEXT DEFAULT '',
    length REAL DEFAULT 0,
    width REAL DEFAULT 0,
    gsm REAL DEFAULT 0,
    packaging REAL DEFAULT 0,
    no_of_packets INTEGER DEFAULT 0,
    weight REAL DEFAULT 0,
    rate_per_kg REAL DEFAULT 0,
    no_of_bundles INTEGER DEFAULT 0,
    rate_per_bundle REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    has_loading_charges INTEGER DEFAULT 0,
    loading_charges REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    invoice_date TEXT NOT NULL,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    final_amount REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid','paid')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS smtp_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    host TEXT DEFAULT '',
    port INTEGER DEFAULT 587,
    secure INTEGER DEFAULT 0,
    username TEXT DEFAULT '',
    password TEXT DEFAULT ''
  );

  INSERT OR IGNORE INTO smtp_config (id) VALUES (1);
`);

// Migration: Add invoice_visible_columns if missing
try {
  db.prepare("ALTER TABLE clients ADD COLUMN invoice_visible_columns TEXT DEFAULT '[]'").run();
} catch (err) {
  if (!err.message.includes('duplicate column name')) {
    console.error('Migration error (clients.invoice_visible_columns):', err.message);
  }
}

// Migration: Add missing columns to companies table
const migrations = [
  "ALTER TABLE companies ADD COLUMN owner_name TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN pan_id TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN udyam_certificate_path TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN abbreviation TEXT DEFAULT ''"
];

migrations.forEach(sql => {
  try {
    db.prepare(sql).run();
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error(`Migration error (${sql}):`, err.message);
    }
  }
});

export default db;
