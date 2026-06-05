const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body;
    console.log('MP Webhook recibido:', JSON.stringify(body));

    if (body.type !== 'payment') {
      return res.status(200).send('OK - ignorado');
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return res.status(400).send('Sin payment ID');
    }

    const payment = await getMPPayment(paymentId);
    console.log('Pago obtenido:', JSON.stringify(payment));

    if (payment.status !== 'approved') {
      return res.status(200).send('Pago no aprobado todavía');
    }

    const email = payment.payer?.email;
    if (!email) {
      return res.status(200).send('Sin email de pagador');
    }

    console.log(`Activando acceso para: ${email}`);
    await activarAcceso(email);

    return res.status(200).send('Acceso activado correctamente');

  } catch (err) {
    console.error('Error en webhook:', err);
    return res.status(500).send('Error interno: ' + err.message);
  }
};

function getMPPayment(paymentId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mercadopago.com',
      path: `/v1/payments/${paymentId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function activarAcceso(email) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      acceso_activo: true,
      fecha_pago: new Date().toISOString(),
    }),
  });

  const result = await response.json();
  console.log('Resultado Supabase:', JSON.stringify(result));

  if (!response.ok) {
    throw new Error(`Supabase error: ${JSON.stringify(result)}`);
  }

  return result;
}
