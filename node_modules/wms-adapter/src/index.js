// WMS adapter: consumes route_generated → fire-and-forget TCP to wms-sim:7001
const express = require('express');
const amqp = require('amqplib');
const net = require('net');

const app = express();
app.get('/health', (_req, res) => res.send('OK'));

const PORT       = Number(process.env.PORT || 3003);
const HOST       = process.env.HOST || '0.0.0.0';
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';
const ROUTES_EX  = process.env.ROUTES_EX  || 'routes';
const WMS_HOST   = process.env.WMS_HOST   || 'wms-sim';
const WMS_PORT   = Number(process.env.WMS_PORT || 7001);

function sendToWms(payload, attempt = 1) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const data = Buffer.from(JSON.stringify(payload) + '\n');

    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      try { socket.destroy(); } catch {}
      if (err && attempt < 3) {
        return setTimeout(() =>
          sendToWms(payload, attempt + 1).then(resolve, reject), 250);
      }
      err ? reject(err) : resolve();
    };

    // Hard guard (just in case connect never completes)
    const timer = setTimeout(() => finish(new Error('TCP timeout')), 5000);

    socket.once('error', finish);

    socket.connect(WMS_PORT, WMS_HOST, () => {
      // Write the payload; treat successful write as success (fire-and-forget)
      socket.write(data, (err) => {
        if (err) return finish(err);
        // success: resolve immediately; don't wait for 'close'
        finish();
        // try to half-close; socat will drop the other side
        try { socket.end(); } catch {}
      });
    });
  });
}



(async function start() {
  app.listen(PORT, HOST, () =>
    console.log(`WMS Adapter on http://${HOST}:${PORT}`));

  const conn = await amqp.connect(RABBIT_URL);
  const ch   = await conn.createChannel();
  await ch.assertExchange(ROUTES_EX, 'fanout', { durable: true });
  const { queue } = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(queue, ROUTES_EX, '');

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    const route = JSON.parse(msg.content.toString());
    console.log('📦 got route_generated:', route);
    try {
      await sendToWms(route);
      console.log('➡️  forwarded to WMS stub via TCP');
    } catch (e) {
      console.error('❌ WMS TCP send failed:', e.message);
    }
    ch.ack(msg);
  });

  process.on('SIGTERM', async () => { try { await ch.close(); await conn.close(); } catch {}; process.exit(0); });
})();
