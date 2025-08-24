// CMS adapter: JSON + SOAP façade → publishes order_created
const express = require('express');
const amqp = require('amqplib');
const { parseStringPromise } = require('xml2js');

const app = express();

// parsers
app.use(express.json()); // JSON orders
app.use(express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'] })); // SOAP/XML

// config
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';
const ORDERS_EX = process.env.ORDERS_EX || 'orders';

let ch;

// health
app.get('/health', (_req, res) => res.send('OK'));

// JSON endpoint (simple façade)
app.post('/orders', async (req, res) => {
  try {
    const order = req.body || {};
    await publishOrder(order);
    res.status(201).json(order);
  } catch (e) {
    console.error('publish failed:', e);
    res.status(500).json({ error: 'publish_failed' });
  }
});

// SOAP endpoint: /soap/orders
// expects a SOAP body like:
// <Envelope><Body><CreateOrder>
//   <orderId>101</orderId><address>Colombo</address>
//   <items><item><sku>ABC</sku><qty>2</qty></item></items>
// </CreateOrder></Body></Envelope>
app.post('/soap/orders', async (req, res) => {
  try {
    const xml = req.body || '';
    const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: true });

    const body =
      parsed?.Envelope?.Body ||
      parsed?.['soap:Envelope']?.['soap:Body'] ||
      parsed?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body'];

    const reqNode = body?.CreateOrder || body?.createOrder;
    if (!reqNode) throw new Error('No CreateOrder in SOAP body');

    const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
    const itemsNode = reqNode.items?.item || reqNode.items || [];
    const items = asArray(itemsNode).map(i => ({
      sku: i.sku, qty: Number(i.qty)
    }));

    const order = {
      orderId: Number(reqNode.orderId),
      address: reqNode.address,
      items
    };

    await publishOrder(order);

    // minimal SOAP 1.1 success reply
    const ok =
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
         <soap:Body>
           <CreateOrderResponse><status>OK</status></CreateOrderResponse>
         </soap:Body>
       </soap:Envelope>`;
    res.set('Content-Type', 'text/xml').status(200).send(ok);
  } catch (e) {
    console.error('SOAP error:', e.message);
    const fault =
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
         <soap:Body>
           <soap:Fault><faultcode>soap:Server</faultcode><faultstring>${e.message}</faultstring></soap:Fault>
         </soap:Body>
       </soap:Envelope>`;
    res.set('Content-Type', 'text/xml').status(500).send(fault);
  }
});

async function publishOrder(order) {
  if (!ch) throw new Error('channel not ready');
  const payload = Buffer.from(JSON.stringify(order));
  ch.publish(ORDERS_EX, '', payload, { persistent: true });
  console.log('📦 order_created published:', order);
}

(async function start() {
  app.listen(PORT, HOST, () =>
    console.log(`CMS Adapter listening on http://${HOST}:${PORT}`));

  // connect to RabbitMQ (with retry)
  while (!ch) {
    try {
      const conn = await amqp.connect(RABBIT_URL);
      ch = await conn.createChannel();
      await ch.assertExchange(ORDERS_EX, 'fanout', { durable: true });
      console.log(`✅ Connected to RabbitMQ → exchange "${ORDERS_EX}"`);
    } catch (e) {
      console.error('RabbitMQ not ready, retrying in 3s...', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
})();
