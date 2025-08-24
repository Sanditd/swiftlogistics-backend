// index.js – ROS Adapter: consumes orders, generates routes, saves routes, republishes
const express = require('express');
const amqp = require('amqplib');
const { MongoClient } = require('mongodb');

const app = express();

// ---- env ----
const HOST        = process.env.HOST        || '0.0.0.0';
const PORT        = Number(process.env.PORT || 3002);
const RABBIT_URL  = process.env.RABBIT_URL  || 'amqp://rabbitmq';
const ORDERS_EX   = process.env.ORDERS_EX   || 'orders';
const ROUTES_EX   = process.env.ROUTE_EX    || 'routes';
const MONGO_URL   = process.env.MONGO_URL   || 'mongodb://mongo:27017/swiftlogistics';

// ---- health ----
app.get('/health', (_req, res) => res.send('OK'));

let db = null;

app.listen(PORT, HOST, () => {
  console.log(`ROS Adapter on http://${HOST}:${PORT}`);
});

(async () => {
  // Mongo
  try {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    db = client.db();
    console.log('✅ ROS connected to Mongo');
  } catch (e) {
    console.error('ROS Mongo connect failed:', e.message);
  }

  // Rabbit
  const conn = await amqp.connect(RABBIT_URL);
  const ch   = await conn.createChannel();

  await ch.assertExchange(ORDERS_EX, 'fanout', { durable: false });
  await ch.assertExchange(ROUTES_EX, 'fanout', { durable: false });

  const { queue } = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(queue, ORDERS_EX, '');

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    const order = JSON.parse(msg.content.toString());
    console.log('📥 got order:', order);

    // fake route plan
    const route = {
      orderId: order.orderId,
      vehicle: 'VAN-42',
      etaMins: 25,
      createdAt: new Date()
    };

    // persist route
    try {
      if (!db) throw new Error('Mongo not ready');
      await db.collection('routes').insertOne(route);
    } catch (e) {
      console.error('ROS failed to save route:', e.message);
    }

    // publish route
    ch.publish(ROUTES_EX, '', Buffer.from(JSON.stringify(route)));
    console.log('📦 published route_generated:', route);

    ch.ack(msg);
  });

  process.on('SIGTERM', async () => {
    try { await ch.close(); await conn.close(); } catch {}
    process.exit(0);
  });
})();

// List recent routes
app.get('/routes', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const items = await db
      .collection('routes')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    res.send(items);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});
