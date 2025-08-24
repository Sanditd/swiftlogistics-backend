const amqplib = require('amqplib');
const axios = require('axios');
const xml2js = require('xml2js');



const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

async function callCmsSoap(order) {
  const soapEnv =
`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CreateOrder xmlns="http://example.com/cms">
      <OrderId>${order.orderId}</OrderId>
      <Address>${order.address}</Address>
    </CreateOrder>
  </soap:Body>
</soap:Envelope>`;

  const { data: xml } = await axios.post('http://localhost:7070/cms', soapEnv, {
    headers: { 'Content-Type': 'text/xml' }, timeout: 5000
  });
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  return {
    orderId: Number(parsed?.['soap:Envelope']?.['soap:Body']?.CreateOrderResponse?.Order?.Id) || order.orderId,
    address: order.address
  };
}

async function publishOrderCreated(order) {
  const conn = await amqplib.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  // EXCHANGES
  await ch.assertExchange('orders', 'topic', { durable: true });
  await ch.assertExchange('dlx', 'topic', { durable: true });

  // publish to exchange (no need to assert queue here)
  ch.publish('orders', 'order_created', Buffer.from(JSON.stringify(order)));
  console.log('✅ order_created published:', order);

  await ch.close();
  await conn.close();
}

module.exports = { publishOrderCreated };
