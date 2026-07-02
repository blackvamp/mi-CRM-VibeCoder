import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Esquema del MVP (5 entidades) — ver PRD "Datos" y TAL-6.
 *
 * Nota sobre Cliente.estado (Nuevo lead / En negociación / Ganado / Perdido):
 * es un valor CALCULADO a partir de las ventas del cliente, no se guarda ni
 * se edita a mano. Se deriva en una función de consulta (no aquí):
 *   - sin ventas               -> "nuevo_lead"
 *   - alguna venta "abierta"   -> "en_negociacion"
 *   - sin abiertas, alguna "ganada" -> "ganado"
 *   - todas "perdida"          -> "perdido"
 *
 * Las fechas (fecha, vence, fechaHecho) se guardan como string ISO
 * "YYYY-MM-DD" (sin hora), igual que en el prototipo de diseño — el orden
 * lexicográfico coincide con el orden cronológico.
 */
export default defineSchema({
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
    autorId: v.id("usuarios"),
  }).index("by_cliente", ["clienteId"]),

  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(),
    vence: v.string(),
    responsableId: v.id("usuarios"),
    hecho: v.boolean(),
    fechaHecho: v.optional(v.string()),
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
    autorId: v.id("usuarios"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_estado", ["estado"]),

  usuarios: defineTable({
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  }).index("by_email", ["email"]),
});
