// Simple RabbitMQ broker for ROS adapter

const amqplib = require('amqplib');
const { generateOptimisedRoute } = require('../services/rosService');

const RABBITMQ_URL = 'amqp://localhost';

async function consumeOrderCreated() {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('order_created');

  channel.consume('order_created', async (msg) => {
    if (msg !== null) {
      const orderData = JSON.parse(msg.content.toString());
      console.log('Received order_created:', orderData);

      // Call ROS (for now use dummy data)
      const route = await generateOptimisedRoute(orderData);

      // Publish route_generated event
      await channel.assertQueue('route_generated');
      channel.sendToQueue('route_generated', Buffer.from(JSON.stringify(route)));

      console.log('Published route_generated:', route);
      channel.ack(msg);
    }
  });
}

module.exports = { consumeOrderCreated };
