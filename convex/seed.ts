import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

/** Busca un usuario por email (uso interno del seed, para idempotencia). */
export const buscarPorEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return u === null ? null : u._id;
  },
});

/**
 * Seed dev-only de los usuarios del negocio. NO es invocable desde el cliente
 * (internalAction). Idempotente por email. El `rol` solo se produce por este
 * camino (createAccount con profile.rol → createOrUpdateUser lo acepta).
 *
 * Ejecutar en local:
 *   npx convex run seed:sembrarUsuarios '{"martaPassword":"...","carlosPassword":"..."}'
 */
export const sembrarUsuarios = internalAction({
  args: { martaPassword: v.string(), carlosPassword: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const cuentas = [
      {
        email: "admin@talent-network.org",
        name: "Marta López",
        rol: "propietaria" as const,
        password: args.martaPassword,
      },
      {
        email: "carlos@vibecrm.local",
        name: "Carlos Ruiz",
        rol: "comercial" as const,
        password: args.carlosPassword,
      },
    ];
    const resultado: string[] = [];
    for (const c of cuentas) {
      const existente = await ctx.runQuery(internal.seed.buscarPorEmail, {
        email: c.email,
      });
      if (existente !== null) {
        resultado.push(`ya existe: ${c.email}`);
        continue;
      }
      await createAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: c.email, secret: c.password },
        profile: { email: c.email, name: c.name, rol: c.rol },
      });
      resultado.push(`creado: ${c.email} (${c.rol})`);
    }
    return resultado;
  },
});

/**
 * Migra el email de un usuario ya sembrado (uso puntual, ej. cuando el email
 * de prueba de la propietaria se sustituye por el email real que usará para
 * entrar, también con Google). Parchea, en la misma mutación transaccional:
 *   - `users.email`
 *   - `authAccounts.providerAccountId` de su cuenta `password` (el login por
 *     contraseña busca por ese campo, no por `users.email` — si no se migra
 *     junto, la contraseña deja de servir con el email nuevo).
 *
 * Idempotente: si `emailActual` ya no existe pero `emailNuevo` sí, se
 * considera ya migrado y no falla. Explícitamente NO idempotente ante
 * colisión: si `emailNuevo` ya pertenece a otro usuario o ya identifica otra
 * cuenta `password`, falla en vez de crear un duplicado. También falla si el
 * usuario no tiene exactamente una cuenta `password` asociada (0 o más de
 * 1): sin eso no hay un identificador único que migrar con garantías.
 *
 * Ejecutar en local:
 *   npx convex run seed:migrarEmailUsuario \
 *     '{"emailActual":"marta@vibecrm.local","emailNuevo":"admin@talent-network.org"}'
 */
export const migrarEmailUsuario = internalMutation({
  args: { emailActual: v.string(), emailNuevo: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const yaConEmailNuevo = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.emailNuevo))
      .unique();
    const usuario = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.emailActual))
      .unique();

    if (usuario === null) {
      if (yaConEmailNuevo !== null) {
        return `ya migrado: ${args.emailActual} → ${args.emailNuevo}`;
      }
      throw new Error(`No existe ningún usuario con email ${args.emailActual}`);
    }
    if (yaConEmailNuevo !== null && yaConEmailNuevo._id !== usuario._id) {
      throw new Error(`${args.emailNuevo} ya pertenece a otro usuario`);
    }

    const cuentaPassword = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", usuario._id).eq("provider", "password"),
      )
      .unique();
    if (cuentaPassword === null) {
      throw new Error(
        `${args.emailActual} no tiene exactamente una cuenta "password" asociada; no se puede migrar el identificador con garantías`,
      );
    }

    const colisionPassword = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.emailNuevo),
      )
      .unique();
    if (
      colisionPassword !== null &&
      colisionPassword._id !== cuentaPassword._id
    ) {
      throw new Error(
        `${args.emailNuevo} ya identifica otra cuenta "password"`,
      );
    }

    await ctx.db.patch(usuario._id, { email: args.emailNuevo });
    await ctx.db.patch(cuentaPassword._id, {
      providerAccountId: args.emailNuevo,
    });
    return `migrado: ${args.emailActual} → ${args.emailNuevo}`;
  },
});
