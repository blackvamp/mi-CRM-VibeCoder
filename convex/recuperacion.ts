import { v, ConvexError } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Solicitud del código para recuperar la contraseña (TAL-65).
 *
 * Existe como envoltorio en vez de dejar que el cliente llame directamente a
 * `auth:signIn` con `flow: "reset"` por dos motivos que no se pueden resolver
 * desde el frontend:
 *
 * 1. ENUMERACIÓN. La librería lanza `InvalidAccountId` cuando el correo no
 *    tiene cuenta de contraseña, y devuelve `{started:true}` cuando sí la
 *    tiene. Esa diferencia se ve desde la consola del navegador por mucho que
 *    la pantalla enseñe siempre el mismo aviso. Aquí la respuesta es SIEMPRE
 *    `null`, pase lo que pase.
 * 2. CUOTA. La librería solo limita la VERIFICACIÓN de códigos, no su
 *    petición. Sin freno, cualquiera puede lanzar cientos de correos contra un
 *    buzón ajeno desde vibe-crm.net y quemar la reputación del dominio.
 */

const SEGUNDOS_ESPERA = 60;
const MAXIMO_POR_HORA = 3;
const UNA_HORA_MS = 60 * 60 * 1000;

/**
 * Decide y registra la cuota en UNA sola transacción.
 *
 * Que sea una mutation (y no una query + un insert aparte) es lo que hace la
 * comprobación fiable: dos solicitudes simultáneas se serializan y la segunda
 * ve la reserva ya confirmada de la primera. Con lectura y escritura separadas,
 * ambas pasarían el filtro y saldrían dos correos.
 *
 * Devuelve el id de la reserva creada, o null si toca esperar.
 */
export const reservarEnvio = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.id("intentosRecuperacion"), v.null()),
  handler: async (ctx, args) => {
    const ahora = Date.now();
    const desdeHaceUnaHora = ahora - UNA_HORA_MS;

    const recientes = await ctx.db
      .query("intentosRecuperacion")
      .withIndex("by_email_momento", (q) =>
        q.eq("email", args.email).gte("momento", desdeHaceUnaHora),
      )
      .collect();

    // Limpieza acotada: de paso se tiran los intentos viejos de este correo, que
    // ya no cuentan para nada. Evita que la tabla crezca sin fin sin necesidad
    // de un cron.
    const viejos = await ctx.db
      .query("intentosRecuperacion")
      .withIndex("by_email_momento", (q) =>
        q.eq("email", args.email).lt("momento", desdeHaceUnaHora),
      )
      .collect();
    for (const viejo of viejos) {
      await ctx.db.delete(viejo._id);
    }

    if (recientes.length >= MAXIMO_POR_HORA) {
      return null;
    }
    const ultimo = recientes.reduce<number>(
      (max, intento) => Math.max(max, intento.momento),
      0,
    );
    if (ahora - ultimo < SEGUNDOS_ESPERA * 1000) {
      return null;
    }

    return await ctx.db.insert("intentosRecuperacion", {
      email: args.email,
      momento: ahora,
    });
  },
});

/**
 * Suelta una reserva concreta cuando el envío falló.
 *
 * Recibe el id exacto y no "la última de este correo": si Resend tarda más que
 * el cooldown, una segunda solicitud podría haber reservado ya, y borrar la más
 * reciente liberaría la reserva equivocada.
 *
 * Hace falta porque la librería crea el código ANTES de intentar el envío: sin
 * esto, un fallo de Resend consumiría cuota de alguien que nunca recibió nada.
 */
export const liberarEnvio = internalMutation({
  args: { reservaId: v.id("intentosRecuperacion") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reservaId);
    return null;
  },
});

/**
 * Pide un código de recuperación.
 *
 * INVARIANTE: devuelve `null` y NO lanza jamás, exista la cuenta, no exista, o
 * esté Resend caído. Cualquier grieta en esto reabre la enumeración de cuentas:
 * como la librería falla antes de llegar al envío cuando no hay cuenta, un
 * error de entrega solo puede originarse en un correo que SÍ existe, y
 * propagarlo delataría cuáles están dados de alta justo durante una caída.
 */
export const solicitarCodigo = action({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const email = args.email.trim().toLowerCase();
    if (email === "") {
      return null;
    }

    // La cuota se comprueba antes de llamar a signIn: generar un código nuevo
    // borra el anterior, así que dejar pasar una petición repetida invalidaría
    // el código que la persona acaba de recibir.
    const reservaId: Id<"intentosRecuperacion"> | null = await ctx.runMutation(
      internal.recuperacion.reservarEnvio,
      { email },
    );
    if (reservaId === null) {
      return null;
    }

    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "password",
        params: {
          email,
          flow: "reset",
          // Prueba de que la solicitud viene de aquí y no de una llamada suelta
          // a la action pública `auth:signIn`. La comprueba `Password.profile()`
          // en convex/auth.ts; el navegador no conoce este valor.
          secretoInterno: process.env.RECUPERACION_SECRETO,
        },
      });
    } catch (error) {
      if (error instanceof ConvexError) {
        // Falló el envío (lo marca codigoRecuperacion.ts). El código ya se creó,
        // así que se suelta la reserva para no gastarle la cuota a quien no ha
        // recibido nada. Sin el correo en el log: es compartido.
        //
        // La liberación es best-effort: si fallara, no puede convertirse en una
        // excepción hacia fuera, porque solo se llega hasta aquí cuando la
        // cuenta existe y eso volvería a delatarla.
        try {
          await ctx.runMutation(internal.recuperacion.liberarEnvio, {
            reservaId,
          });
        } catch {
          console.error("recuperacion: no se pudo liberar la reserva");
        }
        console.error("recuperacion: no se pudo enviar el código");
      }
      // Cualquier otro error (no hay cuenta de contraseña para ese correo, o la
      // llamada no traía la prueba interna) se traga sin dejar rastro: es una
      // ruta pública y registrar cada intento permitiría inundar los logs.
    }
    return null;
  },
});
