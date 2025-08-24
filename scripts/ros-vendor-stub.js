const express = require('express');
const app = express();
app.use(express.json());
app.post('/optimize-route', (req, res) => {
  const { orderId, address } = req.body || {};
  // simple pretend optimisation
  const route = [address || 'Colombo', 'Gampaha', 'Negombo'];
  res.json({ orderId, route });
});
app.listen(8080, () => console.log('ROS vendor stub on :8080'));
