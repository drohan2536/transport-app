// Uninstall Transport App Windows Service
// Run: node uninstall-service.js (as Administrator)

import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
    name: 'TransportApp',
    script: path.join(__dirname, 'service-launcher.cjs'),
});

svc.on('uninstall', () => {
    console.log('✅ Service uninstalled. It will no longer run in the background.');
});

svc.uninstall();
