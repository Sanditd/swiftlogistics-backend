const axios = require('axios');
const { retry } = require('../../../../packages/shared/retry');

const ROS_API_URL = process.env.ROS_API_URL || 'http://localhost:8080/optimize-route';
const ROS_TIMEOUT_MS = +process.env.ROS_TIMEOUT_MS || 5000;
const ROS_MAX_RETRIES = +process.env.ROS_MAX_RETRIES || 3;

async function generateOptimisedRoute(order) {
  return retry(async () => {
    const { data } = await axios.post(
      ROS_API_URL,
      { orderId: order.orderId, address: order.address },
      { timeout: ROS_TIMEOUT_MS }
    );
    return {
      orderId: data.orderId ?? order.orderId,
      route: data.route ?? data.stops ?? []
    };
  }, { retries: ROS_MAX_RETRIES, baseMs: 400 });
}

module.exports = { generateOptimisedRoute };
