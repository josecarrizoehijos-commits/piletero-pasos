// netlify/functions/mp-webhook.js
// Esta función recibe la notificación de MercadoPago cuando alguien paga
// y activa el acceso en Supabase automáticamente

const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('MP Webhook recibido:', JSON.stringify(body));

    // MercadoPago envía notificaciones de tipo "payment"
    if (body.type !== 'payment') {
      return { statusCode: 200, body: 'OK - ignorado' };
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return { statusCode: 400, body: 'Sin payment ID' };
    }

    // Consultar el pago a la API de MercadoPago
    const payment = await getMPPayment(paymentId);
    console.log('Pago obtenido:', JSON.stringify(payment));

    if (payment.status !== 'approved') {
      return { statusCode: 200, body: 'Pago no aprobado todavía' };
    }

    // Obtener el email del pagador
    const email = payment.payer?.email;
    if (!email) {
      console.error('No se encontró email del pagador');
      return { statusCode: 200, body: 'Sin email de pagador' };
    }

    console.log(`Activando acceso para: ${email}`);

    // Activar acceso en Supabase usando la Service Role Key
    await activarAcceso(email);

    return { statusCode: 200, body: 'Acceso activado correctamente' };

  } catch (err) {
    console.error('Error en webhook:', err);
    return { statusCode: 500, body: 'Error interno: ' + err.message };
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
  // Usamos fetch nativo de Node 18+ (Netlify lo soporta)
  // Primero encontramos el usuario por email via Supabase Admin API
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  // Actualizar la tabla usuarios donde el email coincide
  const res = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`, {
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

  const result = await res.json();
  console.log('Resultado Supabase:', JSON.stringify(result));

  if (!res.ok) {
    throw new Error(`Supabase error: ${JSON.stringify(result)}`);
  }

  return result;
}
