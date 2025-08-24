const amqplib = require('amqplib');
const { generateOptimisedRoute } = require('../services/rosService');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

async function consumeOrderCreated() {
  const conn = await amqplib.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  // Exchanges
  await ch.assertExchange('orders', 'topic', { durable: true });
  await ch.assertExchange('routes', 'topic', { durable: true });
  await ch.assertExchange('dlx', 'topic', { durable: true });

  // Queue bound to orders exchange
  await ch.assertQueue('q.order_created', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'order_created.fail'
    }
  });
  await ch.bindQueue('q.order_created', 'orders', 'order_created');

  ch.consume('q.order_created', async (msg) => {
    try {
      const order = JSON.parse(msg.content.toString());
      const route = await generateOptimisedRoute(order);

      // Publish result
      ch.publish('routes', 'route_generated', Buffer.from(JSON.stringify(route)));
      console.log('Published route_generated:', route);

      ch.ack(msg);
    } catch (e) {
      console.error('ROS failed, sending to DLQ:', e.message);
      ch.nack(msg, false, false); // dead-letter
    }
  });
}

module.exports = { consumeOrderCreated };
