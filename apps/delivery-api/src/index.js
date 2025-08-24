const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const amqplib = require('amqplib');
const multer = require('multer');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/swiftlogistics';
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';
const PORT = +(process.env.PORT_DELIVERY_API || 3002);

const upload = multer({ dest: 'uploads/' });

const Delivery = mongoose.model('Delivery', new mongoose.Schema({
  orderId: Number,
  status: String,           // delivered | failed
  reason: String,           // if failed
  proofPhotoPath: String,   // uploaded photo path
  signatureBase64: String,  // (optional) if you capture signatures
  ts: { type: Date, default: Date.now }
}));

(async () => {
  await mongoose.connect(MONGO_URL);

  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  // Live route updates from ROS → driver app
  (async () => {
    const conn = await amqplib.connect(RABBIT_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange('routes', 'topic', { durable: true });
    const q = await ch.assertQueue('', { exclusive: true });
    await ch.bindQueue(q.queue, 'routes', 'route_generated');
    ch.consume(q.queue, (msg) => {
      io.emit('route_update', JSON.parse(msg.content.toString()));
      ch.ack(msg);
    });
  })();

  // Driver endpoints
  app.get('/manifest/:driverId', (req, res) => {
    // later fetch from DB; for demo return static
    res.json({ driverId: req.params.driverId, route: ['Colombo','Gampaha','Negombo']});
  });

  app.post('/delivery-status', upload.single('photo'), async (req, res) => {
    const { orderId, status, reason, signatureBase64 } = req.body;
    const proofPhotoPath = req.file?.path;
    const doc = await Delivery.create({ orderId, status, reason, signatureBase64, proofPhotoPath });
    res.json(doc);
  });

  server.listen(PORT, () => console.log(`Delivery API on :${PORT}`));
})();
