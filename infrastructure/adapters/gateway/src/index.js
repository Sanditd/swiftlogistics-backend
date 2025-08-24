// gateway/src/index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// health
app.get('/health', (_req, res) => res.send('OK'));

// proxy orders to CMS adapter
app.post('/api/orders', async (req, res) => {
  try {
    // inside Docker, reach CMS by its service name + container port
    const cmsUrl = process.env.CMS_URL || 'http://cms-adapter:3001/orders';
    const r = await axios.post(cmsUrl, req.body, { timeout: 5000 });
    res.status(r.status).send(r.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const data = err.response?.data || { error: err.message };
    res.status(status).send(data);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway on http://0.0.0.0:${PORT}`);
});
