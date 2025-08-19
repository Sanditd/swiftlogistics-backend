// rosService.js – calls the external ROS REST API (temporarily returns a fixed route)
const axios = require('axios');

async function generateOptimisedRoute(orderData) {
  // ❗️for testing, return a hard-coded result
  // In the next iteration, replace this with a real axios.post() call to the ROS API
  return {
    orderId: orderData.orderId,
    route: ['Colombo', 'Gampaha', 'Negombo']
  };

  /*
  // Example for future:
  const response = await axios.post('http://<ROS_API_URL>/optimize-route', {
    orderId: orderData.orderId,
    address: orderData.address
  });
  return response.data;
  */
}

module.exports = { generateOptimisedRoute };
