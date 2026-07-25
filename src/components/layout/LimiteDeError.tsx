"use client";

import { Component, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mensajeError } from "@/lib/errores";

/**
 * Red de seguridad del armazón de la aplicación (TAL-60).
 *
 * Se monta DENTRO de `(app)/layout.tsx`, envolviendo a la barra lateral, la
 * cabecera móvil, la barra inferior y el contenido. Esa ubicación es
 * deliberada: `Sidebar`, `MobileHeader` y `TabBarNav` consultan
 * `usuarios.actual` y se renderizan desde el layout, y un `error.tsx` de
 * Next.js NO envuelve el layout de su propio segmento — así que allí estos tres
 * fallos se escaparían.
 *
 * El caso que de verdad importa: a alguien le retiran el acceso mientras tiene
 * la aplicación abierta. Sus sesiones se cierran, pero el token que ya tiene en
 * el navegador sigue siendo válido hasta una hora, así que durante esa ventana
 * la aplicación carga y todas sus consultas fallan. Sin esto vería una pantalla
 * rota sin ninguna explicación.
 */

function Aviso({ error }: { error: unknown }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const mensaje = mensajeError(
    error,
    "No hemos podido cargar tus datos. Vuelve a intentarlo en un momento.",
  );

  // Se espera a que `signOut` termine y se navega, igual que en `Sidebar`.
  // Sin la navegación la persona se quedaría mirando esta misma pantalla —
  // el límite de error no se reinicia solo— y tendría que recargar a mano.
  async function salir() {
    setSaliendo(true);
    await signOut();
    router.replace("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-text-subtle">
          <ShieldAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-base font-semibold text-text">No puedes seguir</h1>
        <p className="mt-1.5 text-sm text-text-muted">{mensaje}</p>
        <Button className="mt-5 w-full" loading={saliendo} onClick={salir}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

export class LimiteDeError extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  render() {
    if (this.state.error !== null) {
      return <Aviso error={this.state.error} />;
    }
    return this.props.children;
  }
}
