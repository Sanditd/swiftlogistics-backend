// wmsService.js – will later send the route to the WMS (via TCP)
// for now just log it

const amqplib = require('amqplib');
const RABBITMQ_URL = 'amqp://localhost';

async function consumeRouteGenerated() {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('route_generated');

  channel.consume('route_generated', async (msg) => {
    if (msg !== null) {
      const route = JSON.parse(msg.content.toString());
      console.log('Received route from ROS:', route);

      // TODO: later send to WMS over TCP

      channel.ack(msg);
    }
  });
}

module.exports = { consumeRouteGenerated };
