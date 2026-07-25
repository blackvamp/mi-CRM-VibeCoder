import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Paso 1 del acceso: la persona escribe solo su correo y el servidor decide qué
 * pantalla le toca (TAL-60).
 *
 * Existe porque quien entra por primera vez NO ha olvidado su contraseña: nunca
 * la ha tenido. Mandarla a "¿Olvidaste tu contraseña?" era mentirle, y además
 * dejaba el alta a medias.
 */

/** Lo que sabe el servidor de un correo, sin decir si existe. */
export const estaPendiente = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    return (
      u !== null &&
      u.activo !== false &&
      u.contrasenaPendiente === true &&
      (u.rol === "propietaria" || u.rol === "comercial")
    );
  },
});

/**
 * Devuelve qué pedirle a continuación: `"contrasena"` o `"codigo"`.
 *
 * QUÉ REVELA, Y QUÉ NO. Es lo importante de esta función, porque cualquiera
 * puede llamarla con el correo que quiera.
 *
 * Solo devuelve `"codigo"` cuando ese correo es de alguien a quien se invitó y
 * todavía no ha entrado nunca. TODO lo demás —un correo desconocido, uno que ya
 * tiene contraseña, uno con el acceso retirado— devuelve `"contrasena"` y acaba
 * en el mismo mensaje genérico de siempre. Es decir: esto NO dice quién tiene
 * cuenta, que es el agujero que cerró TAL-66 y que no se reabre aquí.
 *
 * Lo único que llega a distinguirse es "a esta dirección se la invitó y aún no
 * ha entrado", un estado que se apaga solo en cuanto la persona accede
 * (`beforeSessionCreation`, convex/auth.ts). Y lo peor que se puede hacer con
 * ello es dispararle códigos a un buzón ajeno, cosa que ya limita la cuota de
 * 3/hora por correo de `recuperacion.solicitarCodigo`. Riesgo aceptado
 * conscientemente y registrado en TAL-67.
 *
 * NO LANZA NUNCA, igual que `solicitarCodigo`: un fallo de envío que se
 * propagara solo podría venir de un correo que existe, y eso volvería a
 * delatarlo. Si el envío falla, la persona ve igualmente la pantalla del código
 * y puede pedir otro con el botón de reenviar.
 */
export const comprobarCorreo = action({
  args: { email: v.string() },
  returns: v.union(v.literal("contrasena"), v.literal("codigo")),
  handler: async (ctx, args): Promise<"contrasena" | "codigo"> => {
    const email = args.email.trim().toLowerCase();
    if (email === "") return "contrasena";

    const pendiente: boolean = await ctx.runQuery(
      internal.acceso.estaPendiente,
      { email },
    );
    if (!pendiente) return "contrasena";

    // Se reutiliza tal cual el emisor de códigos de TAL-65: trae la cuota por
    // correo, la comprobación del secreto interno y la neutralidad ante fallos.
    // No se duplica ni una línea de esa lógica.
    await ctx.runAction(api.recuperacion.solicitarCodigo, { email });
    return "codigo";
  },
});
