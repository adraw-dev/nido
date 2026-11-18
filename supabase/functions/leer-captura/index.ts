// Nido · Edge Function "leer-captura"
//
// Recibe una captura de los movimientos del banco (base64) y devuelve cada
// movimiento transcrito TAL COMO SE VE: fecha, descripción, valor con su
// signo y color. La app decide gasto/ingreso, el valor y la fecha con su
// propia lógica (src/features/finance/import/parse.ts); aquí solo se lee.
//
// Modelo: Claude Haiku 5.5 (el más barato: US$0,10 / US$0,50 por millón de
// tokens de entrada / salida). Una captura cuesta ~US$0,0004.
// La imagen no se guarda en ningún lado.
//
// Secretos (Supabase → Edge Functions → Secrets): ANTHROPIC_API_KEY.
// Solo usuarios con sesión: deja activado "Verify JWT" al desplegar.

import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1/helpers/zod';
import { z } from 'npm:zod@4';

const MODEL = 'claude-haiku-5-5';
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
// ~5 MB de imagen (el límite de la API para imágenes en base64).
const MAX_BASE64 = 5 * 1024 * 1024 * 1.37;

const Movement = z.object({
  date_text: z.string(),
  description: z.string(),
  amount_text: z.string(),
  color: z.enum(['rojo', 'verde', 'otro']),
});
const Reading = z.object({
  is_bank_movements: z.boolean(),
  movements: z.array(Movement),
});

const SYSTEM = `Transcribes capturas de pantalla de apps bancarias colombianas (Bancolombia, Nequi, Davivienda, Daviplata, etc.).
Devuelve cada movimiento visible, de arriba hacia abajo, copiando el texto exactamente como aparece:
- date_text: la fecha del movimiento tal cual ("15 NOV 2026", "Hoy", "13/11/2026"). Si varios movimientos comparten un encabezado de fecha, repítelo en cada uno.
- description: el texto del movimiento tal cual (no lo corrijas ni lo traduzcas).
- amount_text: el valor con TODOS sus símbolos tal cual, incluido el signo menos si lo tiene ("COP -$ 14.480,00", "$ 2.913.136,00"). Nunca agregues ni quites el signo menos.
- color: el color del valor ("rojo", "verde" u "otro").
No incluyas saldos, totales, botones ni textos que no sean movimientos. Si un movimiento está cortado y no se ve su valor, omítelo.
Si la imagen no muestra movimientos bancarios, responde is_bank_movements: false y movements vacío.`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const client = new Anthropic(); // lee ANTHROPIC_API_KEY de los secretos

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  let image: string;
  let mediaType: (typeof MEDIA_TYPES)[number];
  try {
    const body = await req.json();
    image = String(body.image ?? '').replace(/^data:[^,]+,/, '');
    mediaType = MEDIA_TYPES.includes(body.mediaType) ? body.mediaType : 'image/jpeg';
  } catch {
    return json({ error: 'Cuerpo inválido.' }, 400);
  }
  if (!image) return json({ error: 'Falta la imagen.' }, 400);
  if (image.length > MAX_BASE64) return json({ error: 'La imagen es muy pesada (máximo 5 MB).' }, 413);

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      // Transcribir no necesita pensar mucho: menos tokens de salida, menos costo.
      output_config: { effort: 'low', format: zodOutputFormat(Reading) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Transcribe los movimientos de esta captura.' },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') return json({ error: 'No se pudo leer esta imagen.' }, 422);
    if (response.stop_reason === 'max_tokens') return json({ error: 'La captura tiene demasiados movimientos. Recórtala.' }, 422);
    const reading = response.parsed_output;
    if (!reading) return json({ error: 'No se entendió la respuesta de la IA. Intenta de nuevo.' }, 502);
    if (!reading.is_bank_movements) return json({ error: 'La imagen no parece una lista de movimientos del banco.' }, 422);

    return json({
      movements: reading.movements,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Demasiadas lecturas seguidas. Espera un momento.' }, 429);
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY inválida o ausente');
      return json({ error: 'La lectura no está configurada (clave de la IA).' }, 500);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error('Solicitud rechazada', error.message);
      return json({ error: 'La IA no aceptó la imagen. Prueba con otra captura.' }, 422);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Error de la API ${error.status}`, error.message);
      return json({ error: 'El servicio de lectura falló. Intenta de nuevo.' }, 502);
    }
    console.error(error);
    return json({ error: 'No se pudo leer la captura.' }, 500);
  }
});
