import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUsuario } from "./authz";

export const ESTADO_CLIENTE = v.union(
  v.literal("nuevo_lead"),
  v.literal("en_negociacion"),
  v.literal("ganado"),
  v.literal("perdido"),
);

/**
 * Estado calculado del cliente a partir de sus ventas (regla en schema.ts).
 * No es una función pública; se reutiliza desde otras funciones Convex.
 */
export async function estadoDe(ctx: QueryCtx, clienteId: Id<"clientes">) {
  const ventas = await ctx.db
    .query("ventas")
    .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
    .collect();
  if (ventas.length === 0) return "nuevo_lead" as const;
  if (ventas.some((x) => x.estado === "abierta")) return "en_negociacion" as const;
  if (ventas.some((x) => x.estado === "ganada")) return "ganado" as const;
  return "perdido" as const;
}

/** Lista mínima de clientes para los selectores (Nueva tarea, etc.). */
export const listar = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("clientes"), nombre: v.string() })),
  handler: async (ctx) => {
    await requireUsuario(ctx);
    const cs = await ctx.db.query("clientes").collect();
    return cs.map((c) => ({ _id: c._id, nombre: c.nombre }));
  },
});

/** Alta rápida de cliente (F1, base). Requiere nombre y ≥1 medio de contacto. */
export const crear = mutation({
  args: {
    nombre: v.string(),
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canalOrigen: v.optional(
      v.union(
        v.literal("web"),
        v.literal("redes"),
        v.literal("email"),
        v.literal("whatsapp"),
      ),
    ),
    nota: v.optional(v.string()),
  },
  returns: v.id("clientes"),
  handler: async (ctx, args) => {
    await requireUsuario(ctx);
    const nombre = args.nombre.trim();
    if (nombre.length === 0) throw new ConvexError("El nombre es obligatorio");
    const telefono = args.telefono?.trim() || undefined;
    const email = args.email?.trim() || undefined;
    if (!telefono && !email) {
      throw new ConvexError("Indica al menos un teléfono o un email");
    }
    return await ctx.db.insert("clientes", {
      nombre,
      empresa: args.empresa?.trim() || undefined,
      telefono,
      email,
      canalOrigen: args.canalOrigen,
      nota: args.nota?.trim() || undefined,
    });
  },
});
