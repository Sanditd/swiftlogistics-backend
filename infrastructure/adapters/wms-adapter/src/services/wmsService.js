const amqplib = require('amqplib');
const net = require('net');
const { retry } = require('../../../../packages/shared/retry');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';
const WMS_HOST = process.env.WMS_HOST || 'localhost';
const WMS_PORT = +(process.env.WMS_PORT || 7001);

function sendToWms(route) {
  return retry(() => new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: WMS_HOST, port: WMS_PORT }, () => {
      socket.write(JSON.stringify(route) + '\n'); // trivial line protocol
    });
    socket.setTimeout(4000);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('WMS timeout')); });
    socket.on('error', reject);
    socket.on('close', resolve); // treat clean close as success
  }), { retries: 3, baseMs: 300 });
}

async function consumeRouteGenerated() {
  const conn = await amqplib.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange('routes', 'topic', { durable: true });
  await ch.assertExchange('dlx', 'topic', { durable: true });

  await ch.assertQueue('q.route_generated', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'route_generated.fail'
    }
  });
  await ch.bindQueue('q.route_generated', 'routes', 'route_generated');

  ch.consume('q.route_generated', async (msg) => {
    const route = JSON.parse(msg.content.toString());
    console.log('Received route from ROS:', route);
    try {
      await sendToWms(route);
      ch.ack(msg);
    } catch (e) {
      console.error('WMS send failed:', e.message);
      ch.nack(msg, false, false); // DLQ
    }
  });
}

module.exports = { consumeRouteGenerated };
