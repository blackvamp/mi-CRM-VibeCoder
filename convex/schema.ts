import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Esquema del MVP — ver PRD "Datos" y TAL-6.
 *
 * Identidad: se usa la tabla `users` de Convex Auth (authTables), extendida con
 * el campo `rol` del negocio. El resto de authTables (authSessions, authAccounts,
 * …) se incluye tal cual con el spread. `autorId` / `responsableId` /
 * `completadoPorId` referencian `users`.
 *
 * Nota sobre Cliente.estado (Nuevo lead / En negociación / Ganado / Perdido):
 * es un valor CALCULADO a partir de las ventas del cliente, no se guarda ni se
 * edita a mano. Se deriva en el helper `estadoDe` (convex/clientes.ts):
 *   - sin ventas                    -> "nuevo_lead"
 *   - alguna venta "abierta"        -> "en_negociacion"
 *   - sin abiertas, alguna "ganada" -> "ganado"
 *   - todas "perdida"               -> "perdido"
 *
 * Las fechas (fecha, vence, fechaHecho) se guardan como string ISO "YYYY-MM-DD"
 * (sin hora), en zona local del usuario — el orden lexicográfico coincide con el
 * cronológico.
 */
export default defineSchema({
  ...authTables,

  // Tabla `users` de Convex Auth extendida con `rol`. Debe conservar los campos
  // e índice de authTables (perder el índice `email` o un campo rompe el login).
  // `rol` es opcional en el schema pero lo exige `requireUsuario`: solo el seed
  // (vía createAccount con profile.rol) puede provisionarlo.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    rol: v.optional(v.union(v.literal("propietaria"), v.literal("comercial"))),
  }).index("email", ["email"]),

  clientes: defineTable({
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
    // "fecha de alta" = _creationTime (campo automático de Convex).
  })
    .index("by_email", ["email"])
    .searchIndex("search_nombre", { searchField: "nombre" }),

  interacciones: defineTable({
    clienteId: v.id("clientes"),
    fecha: v.string(),
    canal: v.union(
      v.literal("llamada"),
      v.literal("email"),
      v.literal("whatsapp"),
      v.literal("en_persona"),
    ),
    texto: v.string(),
    autorId: v.id("users"),
    // Compuesto: `order("desc")` sobre él da el historial ya ordenado por fecha
    // y, en empates del mismo día (fecha no lleva hora), por _creationTime.
  }).index("by_cliente_fecha", ["clienteId", "fecha"]),

  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(),
    vence: v.string(),
    responsableId: v.id("users"),
    hecho: v.boolean(),
    fechaHecho: v.optional(v.string()),
    // Quién marcó el seguimiento como hecho — solo esa persona puede deshacerlo.
    completadoPorId: v.optional(v.id("users")),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_hecho_vence", ["hecho", "vence"]),

  ventas: defineTable({
    clienteId: v.id("clientes"),
    concepto: v.string(),
    importe: v.number(),
    estado: v.union(
      v.literal("abierta"),
      v.literal("ganada"),
      v.literal("perdida"),
    ),
    fecha: v.string(),
    autorId: v.id("users"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_estado", ["estado"]),
});
