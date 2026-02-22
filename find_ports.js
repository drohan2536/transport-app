import net from 'net';

async function findFreePort(startPort) {
    let port = startPort;
    while (port < startPort + 50) {
        try {
            await new Promise((resolve, reject) => {
                const server = net.createServer();
                server.unref();
                server.on('error', reject);
                server.listen(port, () => {
                    server.close(resolve);
                });
            });
            return port;
        } catch (e) {
            port++;
        }
    }
    return null;
}

(async () => {
    const backend = await findFreePort(3005);
    const frontend = await findFreePort(5182);
    console.log(`FREE_BACKEND=${backend}`);
    console.log(`FREE_FRONTEND=${frontend}`);
})();
