import { ShieldAlert } from "lucide-react";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/lib/convexApi";
import { guardAuth } from "@/lib/authGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { EquipoClient } from "./EquipoClient";

/**
 * Gate REAL de autorización (no solo ocultar el tab): primero exige sesión
 * (guardAuth → /login si no hay), luego comprueba el ROL server-side. Un usuario
 * "comercial" que teclee /equipo ve "Acceso restringido".
 *
 * Es la primera de tres capas, no la única: las funciones de Convex del panel
 * exigen `requirePropietaria` por su cuenta, y las reglas de negocio se
 * comprueban dentro de cada mutation.
 */
export default async function EquipoPage() {
  await guardAuth();

  const token = await convexAuthNextjsToken();
  const user = await fetchQuery(api.usuarios.actual, {}, { token });

  if (user.rol !== "propietaria") {
    return (
      <div className="pt-8">
        <EmptyState
          icon={<ShieldAlert className="size-6" aria-hidden />}
          title="Acceso restringido"
          help="Solo la dueña puede gestionar el equipo."
        />
      </div>
    );
  }

  // Se le pasa quién es para poder ocultar el botón de retirarse el acceso a
  // una misma. Es solo presentación: quien lo impide de verdad es el servidor.
  return <EquipoClient yoId={user._id} />;
}
