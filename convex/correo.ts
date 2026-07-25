import { v, ConvexError } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Envío de correo con Resend, compartido por los dos mensajes que manda el
 * producto: el código para recuperar la contraseña (`codigoRecuperacion.ts`) y
 * el aviso de que esa contraseña ha cambiado (aquí abajo).
 *
 * Se usa `fetch` y no el SDK de Resend porque `enviarCorreo` acaba ejecutándose
 * dentro de la action `signIn` declarada en convex/auth.ts, y ese fichero
 * exporta también una query y una mutation: nunca puede llevar "use node". El
 * aislado de Convex trae fetch, así que no hace falta nada más.
 *
 * Este módulo NO debe importar `./_generated/api`: lo importa
 * `codigoRecuperacion.ts`, que a su vez importa `auth.ts`, y el ciclo rompe la
 * inferencia de tipos de Convex.
 */

export const REMITENTE = "Vibe CRM <no-reply@vibe-crm.net>";

/**
 * CONTRATO: los tres modos de fallo (falta la API key, `fetch` no llega, o
 * Resend responde con error) lanzan **ConvexError**, nunca otro tipo de error.
 *
 * No es cosmético: `recuperacion.solicitarCodigo` distingue por el tipo, y solo
 * ante un ConvexError libera la reserva de cuota de quien no ha recibido nada.
 * Un TypeError de red escapando de aquí se confundiría con "esa cuenta no
 * existe" y le gastaría el intento a la persona.
 */
export async function enviarCorreo({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey === undefined) {
    // Marcador interno para quien llame; su texto no llega a la persona (ver la
    // nota sobre enumeración en recuperacion.ts).
    throw new ConvexError("Falta RESEND_API_KEY");
  }

  let respuesta: Response;
  try {
    respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: REMITENTE, to: [to], subject, text, html }),
    });
  } catch {
    // Timeout, DNS o red: `fetch` lanza un TypeError, que no es ConvexError.
    // Se reetiqueta como fallo de entrega para no romper el contrato de arriba.
    console.error("Resend: no se pudo conectar");
    throw new ConvexError("Resend no aceptó el envío");
  }

  if (!respuesta.ok) {
    // Solo el código de estado: el cuerpo puede traer el correo de destino y
    // este log es compartido. Nunca se registra el token, el destinatario ni la
    // cabecera de autorización.
    console.error(`Resend respondió ${respuesta.status}`);
    throw new ConvexError("Resend no aceptó el envío");
  }
}

const ASUNTO_CAMBIO = "Tu contraseña de Vibe CRM ha cambiado";

function textoCambio(): string {
  return `Hola,

Te escribimos para avisarte de que la contraseña de tu cuenta de Vibe CRM
acaba de cambiar, y de que se ha cerrado la sesión en tus otros dispositivos.

Si has sido tú, no tienes que hacer nada.

Si NO has sido tú, alguien ha entrado en tu correo: cambia cuanto antes la
contraseña de tu cuenta de correo y avisa a la responsable del CRM.

— Vibe CRM`;
}

/**
 * Sin enlaces ni botones a propósito: un correo de seguridad que pide hacer clic
 * es indistinguible de un phishing, y aquí no hay nada que confirmar.
 */
function htmlCambio(): string {
  return `<div style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;font-size:17px;font-weight:600">Vibe CRM</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      La contraseña de tu cuenta acaba de cambiar, y se ha cerrado la sesión en
      tus otros dispositivos.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      Si has sido tú, no tienes que hacer nada.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#78716c">
      Si no has sido tú, alguien ha entrado en tu correo: cambia cuanto antes la
      contraseña de tu cuenta de correo y avisa a la responsable del CRM.
    </p>
  </div>
</div>`;
}

/**
 * Aviso de que la contraseña ha cambiado (TAL-66).
 *
 * La programa `createOrUpdateUser` (convex/auth.ts) con el scheduler al canjear
 * el código de recuperación. Es la única señal que le queda a la persona si
 * quien pidió el código fue otro: el correo del código avisa ANTES, pero para
 * entonces el buzón ya podría estar en manos ajenas.
 *
 * Entrega best-effort: un fallo de Resend se registra y se queda ahí. Va en una
 * tarea programada aparte precisamente para que no pueda tumbar el cambio de
 * contraseña, que a estas alturas ya se ha completado.
 */
export const avisarCambioContrasena = internalAction({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (_ctx, args): Promise<null> => {
    try {
      await enviarCorreo({
        to: args.email,
        subject: ASUNTO_CAMBIO,
        text: textoCambio(),
        html: htmlCambio(),
      });
    } catch {
      // Sin el correo en el log: es compartido.
      console.error("aviso de cambio: no se pudo enviar");
    }
    return null;
  },
});
