const express = require('express');
const amqp = require('amqplib');
const net = require('net');
const { MongoClient } = require('mongodb');

const app = express();
app.get('/health', (_req, res) => res.send('OK'));

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';
const ROUTE_EX   = process.env.ROUTE_EX   || 'routes';
const WMS_HOST   = process.env.WMS_HOST   || 'wms-sim';
const WMS_PORT   = Number(process.env.WMS_PORT || 7001);
const MONGO_URL  = process.env.MONGO_URL  || 'mongodb://mongo:27017';
const DB_NAME    = process.env.DB_NAME    || 'swiftlogistics';
const PORT       = Number(process.env.PORT || 3003);

function sendToWms(payload) {
  return new Promise((resolve, reject) => {
    const host = process.env.WMS_HOST || 'wms-sim';
    const port = Number(process.env.WMS_PORT || 7001);
    const socket = new (require('net').Socket)();
    const body = Buffer.from(JSON.stringify(payload) + '\n');

    // fail if we can't connect quickly
    const connectTimer = setTimeout(() => {
      socket.destroy();
      reject(new Error('TCP connect timeout'));
    }, 2000);

    socket.once('error', (err) => {
      clearTimeout(connectTimer);
      reject(err);
    });

    socket.connect(port, host, () => {
      clearTimeout(connectTimer);
      // write and resolve immediately (fire-and-forget)
      socket.write(body, (err) => {
        if (err) return reject(err);
        try { socket.end(); socket.destroy(); } catch {}
        resolve();                 // ✅ don't wait for remote close
      });
    });
  });
}

(async () => {
  app.listen(PORT, '0.0.0.0', () =>
    console.log(`WMS Adapter on http://0.0.0.0:${PORT}`)
  );

  const conn = await amqp.connect(RABBIT_URL);
  const ch   = await conn.createChannel();
  await ch.assertExchange(ROUTE_EX, 'fanout', { durable: false });
  const { queue } = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(queue, ROUTE_EX, '');

  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const deliveries = mongo.db(DB_NAME).collection('deliveries');

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    const route = JSON.parse(msg.content.toString());
    console.log('📦 got route_generated:', route);

    try {
      await sendToWms(route);
      console.log('📦 forwarded to WMS stub via TCP');
      await deliveries.insertOne({
        ...route,
        status: 'forwarded',
        createdAt: new Date()
      });
    } catch (e) {
      console.error('❌ WMS TCP send failed:', e.message);
    }

    ch.ack(msg);
  });

  process.on('SIGTERM', async () => {
    try { await ch.close(); await conn.close(); await mongo.close(); } catch {}
    process.exit(0);
  });
})();
