const http = require('http');

const options = {
    hostname: 'localhost',
    port: 8085,
    path: '/api/tables/5/kapat',
    method: 'POST'
};

const options3 = { ...options, path: '/api/tables/3/kapat' };
const options9 = { ...options, path: '/api/tables/9/kapat' };

const req = http.request(options, res => {
    console.log(`Masa 5 status: ${res.statusCode}`);
    const req3 = http.request(options3, res3 => {
      console.log(`Masa 3 status: ${res3.statusCode}`);
      const req9 = http.request(options9, res9 => {
        console.log(`Masa 9 status: ${res9.statusCode}`);
      });
      req9.on('error', e => console.error(e));
      req9.end();
    });
    req3.on('error', e => console.error(e));
    req3.end();
});

req.on('error', error => {
  console.error(error);
});

req.end();
