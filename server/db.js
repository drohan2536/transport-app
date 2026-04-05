import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const DB_PATH = path.join(dbDir, 'transport.db');

// Current database instance (mutable — gets swapped on restore)
let currentDb = null;

function initializeDatabase(dbInstance) {
  // Enable WAL mode & foreign keys
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Create tables
  dbInstance.exec(`
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

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    scheduler_interval_minutes INTEGER DEFAULT 60
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number    TEXT NOT NULL UNIQUE,
    chassis_number    TEXT DEFAULT '',
    engine_number     TEXT DEFAULT '',
    model             TEXT DEFAULT '',
    registration_date TEXT DEFAULT '',
    owner_name        TEXT DEFAULT '',
    owner_address     TEXT DEFAULT '',
    owner_email       TEXT DEFAULT '',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicle_documents (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number TEXT NOT NULL,
    doc_name       TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    file_name      TEXT NOT NULL,
    start_date     TEXT NOT NULL,
    expiry_date    TEXT NOT NULL,
    owner_name     TEXT DEFAULT '',
    owner_email    TEXT DEFAULT '',
    reminder_sent  INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    position       TEXT NOT NULL CHECK(position IN ('driver','loader')),
    salary_type    TEXT NOT NULL CHECK(salary_type IN ('weekly','monthly')),
    per_day        REAL NOT NULL DEFAULT 0,
    contact_no     TEXT DEFAULT '',
    bank_name      TEXT DEFAULT '',
    account_no     TEXT DEFAULT '',
    ifsc_code      TEXT DEFAULT '',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id      INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    status         TEXT NOT NULL CHECK(status IN ('present','absent')),
    vehicle_number TEXT DEFAULT '',
    remark         TEXT DEFAULT '',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(worker_id, date)
  );

  CREATE TABLE IF NOT EXISTS worker_advances (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id      INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    amount         REAL NOT NULL DEFAULT 0,
    mode_of_payment TEXT DEFAULT '',
    paid_by        TEXT DEFAULT '',
    remark         TEXT DEFAULT '',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS worker_pending (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id      INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    amount         REAL NOT NULL DEFAULT 0,
    remark         TEXT DEFAULT '',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    date           TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL DEFAULT 'Holiday',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoice_seq_overrides (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    abbreviation   TEXT NOT NULL,
    fy_pattern     TEXT NOT NULL,
    next_seq       INTEGER NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(abbreviation, fy_pattern)
  );

  CREATE TABLE IF NOT EXISTS scheduled_emails (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    scheduled_at    TEXT NOT NULL,
    pdf_base64      TEXT NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled')),
    error_message   TEXT DEFAULT '',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at         DATETIME DEFAULT NULL
  );

  INSERT OR IGNORE INTO smtp_config (id) VALUES (1);
  INSERT OR IGNORE INTO app_settings (id) VALUES (1);
`);

  // Run migrations
  const migrations = [
    "ALTER TABLE clients ADD COLUMN invoice_visible_columns TEXT DEFAULT '[]'",
    "ALTER TABLE companies ADD COLUMN owner_name TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN pan_id TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN udyam_certificate_path TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN abbreviation TEXT DEFAULT ''",
    "ALTER TABLE vehicle_documents ADD COLUMN owner_name TEXT DEFAULT ''",
    "ALTER TABLE vehicle_documents ADD COLUMN owner_email TEXT DEFAULT ''",
    "ALTER TABLE vehicle_documents ADD COLUMN reminder_sent INTEGER DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN adjustment_type TEXT DEFAULT ''",
    "ALTER TABLE invoices ADD COLUMN adjustment_amount REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN adjustment_reason TEXT DEFAULT ''",
    "ALTER TABLE attendance ADD COLUMN extra_pay REAL DEFAULT 0",
    "ALTER TABLE attendance ADD COLUMN work_description TEXT DEFAULT ''"
  ];

  migrations.forEach(sql => {
    try {
      dbInstance.prepare(sql).run();
    } catch (err) {
      if (!err.message.includes('duplicate column name')) {
        console.error(`Migration error (${sql}):`, err.message);
      }
    }
  });
}

// Open the database and run initialization
function openDatabase() {
  const dbInstance = new Database(DB_PATH);
  initializeDatabase(dbInstance);
  return dbInstance;
}

// Initial open
currentDb = openDatabase();

// Proxy that delegates all operations to currentDb
// This ensures that when currentDb is swapped (on restore), all existing
// imports automatically use the new connection without re-importing.
const db = new Proxy({}, {
  get(target, prop) {
    if (prop === '__isProxy') return true;
    const value = currentDb[prop];
    if (typeof value === 'function') {
      return value.bind(currentDb);
    }
    return value;
  },
  set(target, prop, value) {
    currentDb[prop] = value;
    return true;
  }
});

// Close the database connection (releases file locks on WAL/SHM)
export function closeDatabase() {
  if (currentDb) {
    try {
      currentDb.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) { /* ignore */ }
    try {
      currentDb.close();
    } catch (e) {
      console.warn('Warning closing DB:', e.message);
    }
    currentDb = null;
    console.log('🔒 Database connection closed');
  }
}

// Reopen the database (called after restore)
// Closes the old connection (if still open) and opens a fresh one.
export function reopenDatabase() {
  if (currentDb) {
    try { currentDb.close(); } catch (e) { /* ignore */ }
  }
  currentDb = openDatabase();
  console.log('✅ Database connection reopened successfully');
}

export default db;
