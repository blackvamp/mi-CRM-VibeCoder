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

/**
 * Lista de clientes con estado calculado y "último contacto", para /clientes (F3).
 *
 * Escala MVP: `collect()` de toda la tabla + enriquecido N+1 por cliente (`estadoDe`
 * colecta ventas; se colectan interacciones por cliente). Aceptable para decenas de
 * clientes; a cientos/miles habría que paginar o mover la búsqueda al servidor — NO
 * dejar este patrón como implícito si el volumen crece.
 *
 * "Último contacto" = max de `fecha` (ISO, comparación lexicográfica) por collect+reduce.
 * Hoy la tabla `interacciones` está vacía (el registro llega en TAL-12) → devuelve null.
 * Optimización futura: `interacciones.by_cliente` no ordena por fecha; para el "más
 * reciente" eficiente con datos reales, añadir índice compuesto ["clienteId","fecha"].
 */
export const listarConEstado = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("clientes"),
      nombre: v.string(),
      empresa: v.optional(v.string()),
      email: v.optional(v.string()),
      telefono: v.optional(v.string()),
      estado: ESTADO_CLIENTE,
      ultimoContacto: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireUsuario(ctx);
    const clientes = await ctx.db.query("clientes").collect();
    const filas = await Promise.all(
      clientes.map(async (c) => {
        const estado = await estadoDe(ctx, c._id);
        const interacciones = await ctx.db
          .query("interacciones")
          .withIndex("by_cliente", (q) => q.eq("clienteId", c._id))
          .collect();
        const ultimoContacto =
          interacciones.length === 0
            ? null
            : interacciones.reduce(
                (max, i) => (i.fecha > max ? i.fecha : max),
                interacciones[0].fecha,
              );
        return {
          _id: c._id,
          nombre: c.nombre,
          empresa: c.empresa,
          email: c.email,
          telefono: c.telefono,
          estado,
          ultimoContacto,
        };
      }),
    );
    filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return filas;
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
