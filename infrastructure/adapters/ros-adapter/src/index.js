// ROS adapter: consumes order_created, stores to Mongo, calls vendor, publishes route_generated
const express = require('express');
const amqp = require('amqplib');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.get('/health', (_req, res) => res.send('OK'));

const PORT = Number(process.env.PORT || 3002);
const HOST = process.env.HOST || '0.0.0.0';

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';
const ORDERS_EX  = process.env.ORDERS_EX  || 'orders';
const ROUTES_EX  = process.env.ROUTES_EX  || 'routes';

const VENDOR_URL = process.env.VENDOR_URL || 'http://ros-vendor:5678/route';
const MONGO_URL  = process.env.MONGO_URL  || 'mongodb://mongo:27017';
const DB_NAME    = process.env.DB_NAME    || 'swift';
const COLL_ORD   = process.env.COLL_ORD   || 'orders';
const COLL_ROUTE = process.env.COLL_ROUTE || 'routes';

let ch, db, ordersC, routesC;

(async function start() {
  app.listen(PORT, HOST, () =>
    console.log(`ROS Adapter on http://${HOST}:${PORT}`));

  // mongo
  const mcli = new MongoClient(MONGO_URL);
  await mcli.connect();
  db = mcli.db(DB_NAME);
  ordersC = db.collection(COLL_ORD);
  routesC = db.collection(COLL_ROUTE);

  // rabbit
  const conn = await amqp.connect(RABBIT_URL);
  ch = await conn.createChannel();
  await ch.assertExchange(ORDERS_EX, 'fanout', { durable: true });
  await ch.assertExchange(ROUTES_EX, 'fanout', { durable: true });
  const { queue } = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(queue, ORDERS_EX, '');

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    const order = JSON.parse(msg.content.toString());

    // store order
    const createdAt = new Date();
    const { insertedId } = await ordersC.insertOne({ ...order, createdAt });
    console.log('🧾 got order:', { ...order, createdAt, _id: insertedId });

    // call vendor stub (fake routing)
    const { data: routeData } = await axios.post(VENDOR_URL, { orderId: order.orderId });
    const route = {
      orderId: order.orderId,
      vehicle: routeData.vehicle || 'VAN-42',
      etaMins: Number(routeData.etaMins || 25),
      createdAt: new Date()
    };
    const { insertedId: rid } = await routesC.insertOne(route);
    const payload = Buffer.from(JSON.stringify({ ...route, _id: rid }));
    ch.publish(ROUTES_EX, '', payload, { persistent: true });
    console.log('🛰️  published route_generated:', { ...route, _id: rid });

    ch.ack(msg);
  });

  process.on('SIGTERM', async () => {
    try { await ch.close(); await conn.close(); await mcli.close(); } catch {}
    process.exit(0);
  });
})();
