const net = require('net');
const server = net.createServer();

server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('Port 3002 is currently in use');
        process.exit(1);
    } else {
        console.log('Error:', err);
        process.exit(1);
    }
});

server.once('listening', () => {
    console.log('Port 3002 is free');
    server.close();
    process.exit(0);
});

server.listen(3002);
