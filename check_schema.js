
import db from './server/db.js';

const info = db.prepare('PRAGMA table_info(companies)').all();
console.log('Companies Table Columns:');
info.forEach(col => console.log(`- ${col.name} (${col.type})`));

const clientsInfo = db.prepare('PRAGMA table_info(clients)').all();
console.log('\nClients Table Columns:');
clientsInfo.forEach(col => console.log(`- ${col.name} (${col.type})`));
