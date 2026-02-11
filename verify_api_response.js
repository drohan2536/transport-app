
import http from 'http';

// First get the list of invoices to find a valid ID
const listReq = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/invoices',
    method: 'GET'
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error('List invoices failed:', res.statusCode, data);
            return;
        }

        const invoices = JSON.parse(data);
        if (invoices.length === 0) {
            console.log('No invoices found.');
            return;
        }

        const invId = invoices[0].id;
        console.log(`Testing Invoice ID: ${invId}`);

        // Now fetch the single invoice
        const getReq = http.request({
            hostname: 'localhost',
            port: 3001,
            path: `/api/invoices/${invId}`,
            method: 'GET'
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                console.log(`GET /api/invoices/${invId} Status: ${res2.statusCode}`);
                console.log('Response Body:', data2);
            });
        });
        getReq.on('error', e => console.error('Get Invoice Error:', e));
        getReq.end();
    });
});

listReq.on('error', e => console.error('List Invoices Error:', e));
listReq.end();
