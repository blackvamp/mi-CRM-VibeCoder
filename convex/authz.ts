import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Usuario de la sesión actual. Lanza si no hay sesión, si el usuario no está
 * provisionado (sin `rol` válido) o si tiene el acceso retirado.
 *
 * Lo del rol bloquea las cuentas auto-registradas vía
 * `signIn("password", { flow: "signUp" })`, que nunca reciben rol.
 *
 * Es la garantía dura de autorización: toda función de datos empieza por aquí.
 */
export async function requireUsuario(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("No autenticado");
  const user = await ctx.db.get(userId);
  if (user === null) throw new ConvexError("Usuario no encontrado");
  if (user.rol !== "propietaria" && user.rol !== "comercial") {
    throw new ConvexError("Usuario no provisionado");
  }
  // Segunda capa de la desactivación (TAL-60), no una redundancia: la primera
  // —`beforeSessionCreation` en convex/auth.ts— impide crear sesiones NUEVAS,
  // pero no puede hacer nada con las que ya estaban abiertas cuando se retiró
  // el acceso. `desactivar` las invalida, y aun así el JWT ya emitido sigue
  // siendo válido hasta una hora. Esta línea es la que cubre esa ventana, y por
  // estar aquí la cubre para todas las funciones de datos a la vez.
  if (user.activo === false) {
    throw new ConvexError("Tu acceso ha sido desactivado");
  }
  return user;
}

/** Como `requireUsuario`, pero además exige el rol `propietaria`. */
export async function requirePropietaria(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUsuario(ctx);
  if (user.rol !== "propietaria") {
    throw new ConvexError("Acción restringida a la dueña");
  }
  return user;
}
