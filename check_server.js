
import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/invoices',
    method: 'GET',
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            console.log('BODY:', data.substring(0, 200)); // Print first 200 chars
            JSON.parse(data);
            console.log('JSON PARSE: OK');
        } catch (e) {
            console.log('JSON PARSE: FAIL');
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
