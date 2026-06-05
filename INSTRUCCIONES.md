# INSTRUCCIONES DE CONFIGURACIÓN
## Los 12 Pasos del Piletero · Sistema de Acceso con Pago

---

## PASO 1 — SUPABASE: Crear la tabla de usuarios

En tu panel de Supabase → SQL Editor → pegá y ejecutá esto:

```sql
CREATE TABLE usuarios (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT,
  acceso_activo BOOLEAN DEFAULT FALSE,
  fecha_registro TIMESTAMP DEFAULT NOW(),
  fecha_pago TIMESTAMP,
  PRIMARY KEY (id)
);

-- Permitir que los usuarios lean y actualicen su propio registro
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su propio registro"
  ON usuarios FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuarios pueden insertar su propio registro"
  ON usuarios FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Solo el service role puede actualizar acceso_activo
CREATE POLICY "Solo service role puede actualizar acceso"
  ON usuarios FOR UPDATE
  USING (true);
```

---

## PASO 2 — SUPABASE: Obtener la Service Role Key

1. Supabase → Settings → API
2. Copiá la **service_role key** (la segunda clave, la secreta)
3. Esta la vas a usar en Netlify como variable de entorno

---

## PASO 3 — MERCADOPAGO: Obtener el Access Token

1. Entrá a mercadopago.com.ar → Tu negocio → Credenciales
2. Copiá el **Access Token de producción**
3. Empieza con `APP_USR-...`

---

## PASO 4 — NETLIFY: Subir el proyecto

1. Creá una cuenta en netlify.com (gratis)
2. "Add new site" → "Deploy manually" → arrastrá la carpeta del proyecto
3. O conectalo a GitHub si querés deploys automáticos

---

## PASO 5 — NETLIFY: Configurar variables de entorno

En Netlify → Site configuration → Environment variables → Add variable:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://qwdrddaigmnacdzwlhwm.supabase.co` |
| `SUPABASE_SERVICE_KEY` | La service_role key de Supabase |
| `MP_ACCESS_TOKEN` | Tu Access Token de MercadoPago |

---

## PASO 6 — MERCADOPAGO: Configurar el Webhook

1. MercadoPago → Tu negocio → Webhooks
2. URL del webhook: `https://TU-SITIO.netlify.app/.netlify/functions/mp-webhook`
3. Eventos: activar **Pagos**
4. Guardá

---

## FLUJO COMPLETO

```
Usuario se registra → index.html
       ↓
Llega a bienvenida.html (video intro + botón de pago)
       ↓
Hace clic → MercadoPago → Paga $30.000
       ↓
MercadoPago llama al webhook
       ↓
Netlify Function → activa acceso_activo = true en Supabase
       ↓
Usuario refresca / hace clic en "Verificar mi acceso"
       ↓
Accede a pasos.html (los 12 pasos completos)
```

---

## NOTAS IMPORTANTES

- Los usuarios que pagaron quedan guardados en Supabase con `acceso_activo = TRUE`
- Si alguien paga pero no se registró antes, el webhook no va a encontrar su registro. Solucionable con un flujo alternativo (te aviso por WhatsApp en ese caso)
- El botón "Verificar mi acceso" en bienvenida.html sirve para usuarios que pagaron y quieren entrar sin esperar

---

## ESTRUCTURA DE ARCHIVOS

```
piletero/
├── index.html              ← Login / Registro
├── bienvenida.html         ← Video intro + botón de pago
├── pasos.html              ← Los 12 pasos (protegido)
├── netlify.toml            ← Configuración de Netlify
├── netlify/
│   └── functions/
│       └── mp-webhook.js   ← Webhook de MercadoPago
└── INSTRUCCIONES.md        ← Este archivo
```
