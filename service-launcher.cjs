// CommonJS wrapper to launch the ESM server
// node-windows wrapper needs this because it can't handle ESM directly

const { execSync, spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'server', 'index.js');
const cwd = __dirname;

// Start the ESM server as a child process
const child = spawn(process.execPath, [serverPath], {
    cwd: cwd,
    stdio: 'inherit',
    env: { ...process.env }
});

child.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

child.on('exit', (code) => {
    process.exit(code || 0);
});
