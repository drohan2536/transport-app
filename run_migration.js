
import db from './server/db.js';

console.log('Running migration check...');

// We rely on the side-effects of importing db.js which runs the migration code.
// But we can also double check here.

const migrations = [
    "ALTER TABLE companies ADD COLUMN owner_name TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN pan_id TEXT DEFAULT ''",
    "ALTER TABLE companies ADD COLUMN udyam_certificate_path TEXT DEFAULT ''"
];

migrations.forEach(sql => {
    try {
        console.log(`Executing: ${sql}`);
        db.prepare(sql).run();
        console.log('Success.');
    } catch (err) {
        console.log(`Result: ${err.message}`);
    }
});

console.log('Migration check complete.');
