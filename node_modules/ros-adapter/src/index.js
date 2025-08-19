// index.js – entry point for ROS adapter
const { consumeOrderCreated } = require('./brokers/messageBroker');

async function startService() {
  try {
    // Start listening for "order_created" events from the message broker
    await consumeOrderCreated();
    console.log('ROS Service is now listening for order_created events...');
  } catch (err) {
    console.error('Failed to start ROS Service:', err);
  }
}

startService();
