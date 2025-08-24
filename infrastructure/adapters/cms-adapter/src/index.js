// index.js – CMS Adapter: persists orders, publishes to RabbitMQ, exposes read API
const express = require('express');
const amqp = require('amqplib');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

// ---- env (overridable) ----
const HOST        = process.env.HOST        || '0.0.0.0';
const PORT        = Number(process.env.PORT || 3001);
const RABBIT_URL  = process.env.RABBIT_URL  || 'amqp://rabbitmq';
const ORDERS_EX   = process.env.ORDERS_EX   || 'orders';
const MONGO_URL   = process.env.MONGO_URL   || 'mongodb://mongo:27017/swiftlogistics';

// ---- health ----
app.get('/health', (_req, res) => res.send('OK'));

let db = null;
let channel = null;

async function connectMongo() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(); // db name from connection string
  console.log('✅ CMS connected to Mongo');
}

async function connectRabbit() {
  const conn = await amqp.connect(RABBIT_URL);
  channel = await conn.createChannel();
  await channel.assertExchange(ORDERS_EX, 'fanout', { durable: false });
  console.log(`✅ CMS connected RabbitMQ at ${RABBIT_URL}, exchange "${ORDERS_EX}"`);
  process.on('SIGTERM', async () => { try { await channel.close(); await conn.close(); } catch {} process.exit(0); });
}

// Create order -> save to Mongo -> publish event
app.post('/orders', async (req, res) => {
  const order = req.body || {};
  order.createdAt = new Date();

  try {
    if (!db) throw new Error('Mongo not ready');
    if (!channel) throw new Error('RabbitMQ not ready');

    await db.collection('orders').insertOne(order);

    channel.publish(ORDERS_EX, '', Buffer.from(JSON.stringify(order)));
    console.log('🟦 order_created published:', order);

    res.status(201).send(order);
  } catch (e) {
    console.error('CMS save/publish failed:', e);
    res.status(500).send({ error: e.message });
  }
});

// List recent orders
app.get('/orders', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const items = await db
      .collection('orders')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    res.send(items);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Start server immediately; connect backends in background
app.listen(PORT, HOST, () => {
  console.log(`CMS Adapter listening on http://${HOST}:${PORT}`);
});

(async () => {
  try { await connectMongo(); } catch (e) { console.error('CMS Mongo connect failed:', e.message); }
  try { await connectRabbit(); } catch (e) { console.error('CMS Rabbit connect failed:', e.message); }
})();
