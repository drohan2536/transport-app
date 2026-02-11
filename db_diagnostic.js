
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = './data/transport.db';
const logFile = 'schema_diagnostic.txt';

let output = '';
function log(msg) {
    output += msg + '\n';
    console.log(msg);
}

try {
    if (!fs.existsSync(dbPath)) {
        log(`Error: DB file not found at ${dbPath}`);
    } else {
        const db = new Database(dbPath);

        log('--- Companies Table ---');
        const companies = db.prepare('PRAGMA table_info(companies)').all();
        companies.forEach(c => log(`  ${c.name} (${c.type})`));

        log('\n--- Clients Table ---');
        const clients = db.prepare('PRAGMA table_info(clients)').all();
        clients.forEach(c => log(`  ${c.name} (${c.type})`));

        log('\n--- Invoices Table ---');
        const invoices = db.prepare('PRAGMA table_info(invoices)').all();
        invoices.forEach(c => log(`  ${c.name} (${c.type})`));

        log('\n--- Checking for data in these columns ---');
        const sampleCompany = db.prepare('SELECT owner_name, pan_id FROM companies LIMIT 1').get();
        log(`Sample Company Data: ${JSON.stringify(sampleCompany)}`);
    }
} catch (err) {
    log(`CRITICAL ERROR: ${err.message}`);
    log(err.stack);
}

fs.writeFileSync(logFile, output);
console.log(`Diagnostic written to ${logFile}`);
