const net = require('net');
net.createServer(sock => {
  sock.on('data', d => {
    console.log('WMS-SIM got:', d.toString());
    sock.end(); // close after receiving one payload
  });
}).listen(7001, () => console.log('WMS-SIM on :7001'));
