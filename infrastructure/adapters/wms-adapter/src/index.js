// index.js – entry point for WMS adapter
const { consumeRouteGenerated } = require('./services/wmsService');

async function startService() {
  try {
    await consumeRouteGenerated();
    console.log('WMS Service is now listening for route_generated events...');
  } catch (err) {
    console.error('Failed to start WMS Service:', err);
  }
}

startService();
