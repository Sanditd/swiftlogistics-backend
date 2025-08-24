const express = require('express');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.send('OK'));

// The endpoint ros-adapter will call
app.post('/route', (req, res) => {
  console.log('ROS Vendor got order:', req.body);
  // Always return a mock route
  res.json({ vehicle: 'VAN-42', etaMins: 25 });
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ROS Vendor listening on http://0.0.0.0:${PORT}`);
});
