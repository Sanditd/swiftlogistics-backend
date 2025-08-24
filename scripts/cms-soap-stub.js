const express = require('express');
const app = express();
app.use(express.text({ type: '*/*' })); // accept text/xml

app.post('/cms', (req, res) => {
  const xml =
`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CreateOrderResponse xmlns="http://example.com/cms">
      <Order><Id>1001</Id></Order>
    </CreateOrderResponse>
  </soap:Body>
</soap:Envelope>`;
  res.set('Content-Type','text/xml').send(xml);
});

app.listen(7070, () => console.log('CMS SOAP stub on :7070'));
