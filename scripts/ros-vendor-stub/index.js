const express = require('express');
const app = express();
app.use(express.json());

app.post('/optimize-route', (req, res) => {
  const { orderId, address } = req.body || {};
  const route = [address || 'Colombo', 'Gampaha', 'Negombo'];
  res.json({ orderId, route });
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, () => console.log('ROS vendor stub on :' + PORT));
