"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import {
  CalendarPlus,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/convexApi";
import { ESTADO_BADGE } from "@/lib/estadoCliente";
import { Card } from "@/components/ui/Card";
import { Badge, STATUS_LABELS } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { EditarClienteOverlay } from "@/components/overlays/EditarClienteOverlay";

const CANAL_LABEL: Record<string, string> = {
  web: "Web",
  redes: "Redes",
  email: "Email",
  whatsapp: "WhatsApp",
};

// Placeholders de Fase 3/4 (TAL-12 interacción, TAL-13 venta, TAL-15 seguimiento):
// reservan el espacio; se conectarán en sus tareas.
const ACCIONES = [
  { label: "Registrar interacción", icon: MessageSquarePlus },
  { label: "Programar seguimiento", icon: CalendarPlus },
  { label: "Registrar venta", icon: TrendingUp },
];

export function FichaClienteClient({
  id,
  justCreated,
}: {
  id: string;
  justCreated: boolean;
}) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const cliente = useQuery(
    api.clientes.obtener,
    isAuthenticated ? { id } : "skip",
  );

  const [editando, setEditando] = useState(false);
  // Init perezosa: si venimos del alta mostramos el toast desde el estado inicial
  // (no con un setState en efecto, que rompería react-hooks/set-state-in-effect).
  const [toast, setToast] = useState<{ message: string } | null>(() =>
    justCreated ? { message: "Cliente añadido" } : null,
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  // Limpia el ?nuevo=1 de la URL (efecto separado, sin setState).
  useEffect(() => {
    if (justCreated) router.replace(`/clientes/${id}`);
  }, [justCreated, id, router]);

  return (
    <>
      {cliente === undefined ? (
        <FichaSkeleton />
      ) : cliente === null ? (
        <Card padding="none">
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title="Cliente no encontrado"
            help="Puede que se haya eliminado o que el enlace no sea válido."
            action={
              <Button size="compact" onClick={() => router.push("/clientes")}>
                Volver a clientes
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="compact"
              iconLeft={<Pencil className="size-4" aria-hidden />}
              onClick={() => setEditando(true)}
            >
              Editar
            </Button>
          </div>

          <Card>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-start gap-3.5">
                <Avatar name={cliente.nombre} size={52} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h1 className="text-[19px] font-semibold leading-tight text-text">
                    {cliente.nombre}
                  </h1>
                  {cliente.empresa && (
                    <p className="text-[14px] text-text-muted">
                      {cliente.empresa}
                    </p>
                  )}
                </div>
                <Badge
                  status={ESTADO_BADGE[cliente.estado]}
                  className="shrink-0"
                >
                  {STATUS_LABELS[ESTADO_BADGE[cliente.estado]]}
                </Badge>
              </div>

              {cliente.canalOrigen && (
                <div>
                  <Badge status="neutral" dot={false}>
                    Origen: {CANAL_LABEL[cliente.canalOrigen]}
                  </Badge>
                </div>
              )}

              {(cliente.telefono || cliente.email) && (
                <div className="flex flex-col border-t border-border">
                  {cliente.telefono && (
                    <a
                      href={`tel:${cliente.telefono.replace(/\s+/g, "")}`}
                      className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                    >
                      <Phone
                        className="size-[18px] shrink-0 text-text-subtle"
                        aria-hidden
                      />
                      <span className="w-[68px] shrink-0 text-[13px] text-text-subtle">
                        Teléfono
                      </span>
                      <span className="min-w-0 flex-1 text-[14px] text-text">
                        {cliente.telefono}
                      </span>
                    </a>
                  )}
                  {cliente.email && (
                    <a
                      href={`mailto:${cliente.email}`}
                      className="flex items-center gap-3 py-3"
                    >
                      <Mail
                        className="size-[18px] shrink-0 text-text-subtle"
                        aria-hidden
                      />
                      <span className="w-[68px] shrink-0 text-[13px] text-text-subtle">
                        Email
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-text">
                        {cliente.email}
                      </span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-3 md:flex-row">
            {ACCIONES.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() =>
                    setToast({ message: `${a.label} llega pronto.` })
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-[14px] font-medium text-text transition-colors hover:bg-surface-2"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary-subtle text-primary">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  {a.label}
                </button>
              );
            })}
          </div>

          {editando && (
            <EditarClienteOverlay
              cliente={{
                _id: cliente._id,
                nombre: cliente.nombre,
                empresa: cliente.empresa,
                telefono: cliente.telefono,
                email: cliente.email,
              }}
              onClose={() => setEditando(false)}
              onSaved={() => setToast({ message: "Cambios guardados" })}
            />
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} />}
    </>
  );
}

function FichaSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Skeleton width={92} height={44} radius={8} />
      </div>
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5">
            <Skeleton width={52} height={52} radius={9999} />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton width="52%" height={18} />
              <Skeleton width="34%" height={13} />
            </div>
          </div>
          <Skeleton width="100%" height={44} />
          <Skeleton width="100%" height={44} />
        </div>
      </Card>
      <div className="flex flex-col gap-3 md:flex-row">
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            width="100%"
            height={50}
            radius={12}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
}
