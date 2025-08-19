// index.js – entry point for CMS adapter

const express = require('express');
const { publishOrderCreated } = require('./services/cmsService');

const app = express();
app.use(express.json());

// Temporary endpoint to simulate receiving a new order from the CMS
app.post('/order', async (req, res) => {
  const order = req.body;              // e.g. { orderId: 1, address: "Colombo" }
  await publishOrderCreated(order);
  res.json({ message: 'order_created event published', order });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`CMS Adapter running on http://localhost:${PORT}`);
});
