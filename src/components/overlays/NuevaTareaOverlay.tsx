"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle } from "lucide-react";
import { api, type Id } from "@/lib/convexApi";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { hoyLocalISO } from "@/lib/utils";
import { NuevoClienteOverlay } from "./NuevoClienteOverlay";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Nueva tarea" desde Hoy (F8, punto de entrada rápido). Crea un seguimiento con
 * el usuario actual como responsable. Incluye "+ Nuevo cliente", que abre el alta
 * y vuelve con el cliente ya seleccionado.
 */
export function NuevaTareaOverlay({ open, onClose }: Props) {
  const clientes = useQuery(api.clientes.listar, open ? {} : "skip");
  const crear = useMutation(api.seguimientos.crear);
  const [accion, setAccion] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [vence, setVence] = useState(hoyLocalISO());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);

  function reset() {
    setAccion("");
    setClienteId("");
    setVence(hoyLocalISO());
    setError(null);
    setGuardando(false);
  }

  async function guardar() {
    setError(null);
    if (!accion.trim()) {
      setError("Indica qué hay que hacer.");
      return;
    }
    if (!clienteId) {
      setError("Elige un cliente.");
      return;
    }
    if (!vence) {
      setError("Elige una fecha.");
      return;
    }
    setGuardando(true);
    try {
      await crear({
        clienteId: clienteId as Id<"clientes">,
        accion: accion.trim(),
        vence,
      });
      reset();
      onClose();
    } catch {
      setError("No se pudo crear la tarea.");
      setGuardando(false);
    }
  }

  return (
    <>
      <Overlay
        open={open && !nuevoCliente}
        onClose={onClose}
        title="Nueva tarea"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="compact" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="compact" loading={guardando} onClick={guardar}>
              Crear tarea
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-error bg-error-bg px-3 py-2.5 text-[13px] text-error-text"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}
          <Input
            label="Qué hay que hacer"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            autoFocus
            required
          />
          <div className="flex flex-col gap-2">
            <Select
              label="Cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Selecciona un cliente…</option>
              {clientes?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setNuevoCliente(true)}
              className="self-start text-[13px] font-semibold text-primary hover:underline"
            >
              + Nuevo cliente
            </button>
          </div>
          <Input
            label="Fecha"
            type="date"
            value={vence}
            onChange={(e) => setVence(e.target.value)}
          />
        </div>
      </Overlay>

      <NuevoClienteOverlay
        open={nuevoCliente}
        onClose={() => setNuevoCliente(false)}
        onCreated={(id) => {
          setClienteId(id);
          setNuevoCliente(false);
        }}
      />
    </>
  );
}
