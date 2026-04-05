// Install Transport App as a Windows Service
// Run: node install-service.js (as Administrator)

import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
    name: 'TransportApp',
    description: 'Krishna Govinda Tempo Services — Billing & Invoice System',
    script: path.join(__dirname, 'service-launcher.cjs'),
    nodeOptions: [],
    env: [{
        name: 'NODE_ENV',
        value: 'production'
    }, {
        name: 'PORT',
        value: '9090'
    }]
});

svc.on('install', () => {
    console.log('✅ Service installed! Starting...');
    svc.start();
});

svc.on('start', () => {
    console.log('✅ Service is running!');
    console.log('');
    console.log('Open: http://localhost:9090');
    console.log('');
    console.log('The app will now run in the background and auto-start on boot.');
    console.log('To stop:  node uninstall-service.js');
});

svc.on('error', (err) => {
    console.error('❌ Error:', err);
});

svc.install();
