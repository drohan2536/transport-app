import net from 'net';
const ports = [3003, 5180];

for (const port of ports) {
    const server = net.createServer();
    server.on('error', (err) => {
        console.log(`Port ${port} error: ${err.code}`);
    });
    server.listen(port, () => {
        console.log(`Port ${port} is FREE`);
        server.close();
    });
}
setTimeout(() => process.exit(0), 1000);
