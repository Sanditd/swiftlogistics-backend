// cmsService.js – calls CMS SOAP API (later); for now publishes order_created event

const amqplib = require('amqplib');
// const xml2js = require('xml2js'); // for future SOAP calls

const RABBITMQ_URL = 'amqp://localhost';

async function publishOrderCreated(order) {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue('order_created');
  channel.sendToQueue('order_created', Buffer.from(JSON.stringify(order)));

  console.log('✅ order_created event published:', order);

  await channel.close();
  await connection.close();
}

module.exports = { publishOrderCreated };
