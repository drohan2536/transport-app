
import db from './server/db.js';
import fs from 'fs';

const log = [];

function myLog(...args) {
    console.log(...args);
    log.push(args.map(a => String(a)).join(' '));
}

myLog('Running migration...');
try {
    // Force add columns
    try { db.prepare("ALTER TABLE companies ADD COLUMN owner_name TEXT DEFAULT ''").run(); myLog('Added owner_name'); } catch (e) { myLog('owner_name exists/error'); }
    try { db.prepare("ALTER TABLE companies ADD COLUMN pan_id TEXT DEFAULT ''").run(); myLog('Added pan_id'); } catch (e) { myLog('pan_id exists/error'); }
    try { db.prepare("ALTER TABLE companies ADD COLUMN udyam_certificate_path TEXT DEFAULT ''").run(); myLog('Added udyam_cert'); } catch (e) { myLog('udyam_cert exists/error'); }

    // Verify
    const cols = db.prepare('PRAGMA table_info(companies)').all();
    const names = cols.map(c => c.name);
    myLog('Columns in companies table:', JSON.stringify(names));

    if (names.includes('owner_name') && names.includes('pan_id')) {
        myLog('SUCCESS: Columns present.');
    } else {
        myLog('FAILURE: Columns missing.');
    }
} catch (err) {
    myLog('Error:', err.message);
}

fs.writeFileSync('migration_result.txt', log.join('\n'));
