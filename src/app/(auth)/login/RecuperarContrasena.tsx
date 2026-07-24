"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { AlertCircle, Mail } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { mensajeError } from "@/lib/errores";

/**
 * Recuperación de contraseña en dos pasos (TAL-65), dentro de la pantalla de
 * login. Vive en su propio componente para no anidar formularios: el enlace
 * "¿Olvidaste tu contraseña?" está dentro del <form> de acceso, así que al
 * entrar aquí ese formulario se desmonta entero.
 */

// El aviso es el MISMO tanto si el correo tiene cuenta como si no, y también si
// falla el envío. Es deliberado: cualquier mensaje que dependa de la existencia
// de la cuenta convierte esta pantalla en un detector de qué correos están
// dados de alta.
const AVISO_ENVIADO =
  "Si ese correo tiene cuenta con contraseña, te llegará un código en un par de minutos. Mira también el spam.";

const SEGUNDOS_REENVIO = 60;
const LARGO_CODIGO = 8;

/**
 * Deja el código como lo espera el backend: mayúsculas, sin guion ni espacios.
 * Se aceptan las letras que el alfabeto Crockford excluye por confundibles
 * (I y L valen 1; O vale 0), que es justo lo que alguien teclea al leerlas de
 * un correo.
 */
function normalizarCodigo(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, "")
    .slice(0, LARGO_CODIGO);
}

export function RecuperarContrasena({
  emailInicial,
  onCancelar,
}: {
  emailInicial: string;
  onCancelar: () => void;
}) {
  const { signIn } = useAuthActions();
  const solicitarCodigo = useAction(api.recuperacion.solicitarCodigo);
  const router = useRouter();

  const [paso, setPaso] = useState<"pedir-codigo" | "verificar-codigo">(
    "pedir-codigo",
  );
  const [email, setEmail] = useState(emailInicial);
  // El correo con el que se pidió el código, ya normalizado. Se reutiliza tal
  // cual al verificar para que los dos pasos no puedan divergir.
  const [emailEnviado, setEmailEnviado] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [verNueva, setVerNueva] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [errorNueva, setErrorNueva] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  // Cuenta atrás del reenvío.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function pedirCodigo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const canonico = email.trim().toLowerCase();
    if (canonico === "") {
      setError("Escribe tu correo.");
      return;
    }
    setEnviando(true);
    try {
      await solicitarCodigo({ email: canonico });
      setEmailEnviado(canonico);
      setPaso("verificar-codigo");
      setEspera(SEGUNDOS_REENVIO);
    } catch {
      // `solicitarCodigo` está diseñada para no lanzar nunca; si algo llega
      // aquí es un fallo de red o del propio Convex, no del correo consultado.
      setError("No se pudo conectar. Inténtalo de nuevo.");
    }
    setEnviando(false);
  }

  async function reenviar() {
    if (espera > 0 || enviando) return;
    setError(null);
    setErrorCodigo(null);
    setEnviando(true);
    try {
      await solicitarCodigo({ email: emailEnviado });
      setCodigo("");
      setEspera(SEGUNDOS_REENVIO);
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    }
    setEnviando(false);
  }

  async function cambiarContrasena(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrorCodigo(null);
    setErrorNueva(null);

    if (codigo.length < LARGO_CODIGO) {
      setErrorCodigo("Escribe el código completo");
      return;
    }
    if (nueva.length < 8) {
      setErrorNueva("Usa al menos 8 caracteres");
      return;
    }

    setEnviando(true);
    try {
      await signIn("password", {
        email: emailEnviado,
        code: codigo,
        newPassword: nueva,
        flow: "reset-verification",
      });
      // `reset-verification` ya deja la sesión iniciada e invalida las demás.
      router.replace("/hoy");
    } catch (e) {
      // La librería lanza un Error plano e indistinguible para código
      // incorrecto, caducado o de otra cuenta, así que todos caen en el mismo
      // mensaje. El ConvexError de contraseña corta sí trae su propio texto.
      setError(
        mensajeError(
          e,
          "El código no es correcto o ha caducado. Pide uno nuevo si hace falta.",
        ),
      );
      setEnviando(false);
    }
  }

  return (
    <>
      {paso === "pedir-codigo" ? (
        <>
          <h1 className="text-xl font-semibold text-text">
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Escribe tu correo y te mandamos un código para cambiarla.
          </p>

          <form onSubmit={pedirCodigo} className="mt-5 flex flex-col gap-4">
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
              label="Correo"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit" loading={enviando} className="w-full">
              Enviar código
            </Button>

            <button
              type="button"
              onClick={onCancelar}
              className="text-center text-[13px] text-text-muted hover:text-text"
            >
              Volver a iniciar sesión
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-text">Escribe el código</h1>
          <p className="mt-1 text-sm text-text-muted">
            Lo hemos mandado a {emailEnviado}.{" "}
            <button
              type="button"
              onClick={() => {
                setPaso("pedir-codigo");
                setError(null);
                setErrorCodigo(null);
                setErrorNueva(null);
                setCodigo("");
              }}
              className="text-text underline hover:no-underline"
            >
              Cambiar correo
            </button>
          </p>

          <form
            onSubmit={cambiarContrasena}
            className="mt-5 flex flex-col gap-4"
          >
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text-muted"
            >
              <Mail className="mt-px size-4 shrink-0" aria-hidden />
              <span>
                {AVISO_ENVIADO}
                <br />
                ¿Entras con Google? Entonces no usas contraseña: vuelve atrás y
                entra con el botón de Google.
              </span>
            </div>

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
              label="Código"
              name="codigo"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoFocus
              required
              placeholder="XXXX-XXXX"
              maxLength={LARGO_CODIGO + 1}
              value={codigo}
              error={errorCodigo}
              onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
              className="text-center text-[20px] tracking-[0.3em]"
            />

            <div className="relative">
              <Input
                label="Contraseña nueva"
                name="newPassword"
                type={verNueva ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••"
                helper="Mínimo 8 caracteres"
                value={nueva}
                error={errorNueva}
                onChange={(e) => setNueva(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setVerNueva((v) => !v)}
                aria-label={
                  verNueva ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={verNueva}
                className="absolute right-2 top-[34px] flex size-9 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2"
              >
                {verNueva ? (
                  <EyeOff className="size-[18px]" aria-hidden />
                ) : (
                  <Eye className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>

            <Button type="submit" loading={enviando} className="w-full">
              Cambiar contraseña
            </Button>

            <button
              type="button"
              onClick={reenviar}
              disabled={espera > 0 || enviando}
              className="text-center text-[13px] text-text-muted hover:text-text disabled:cursor-default disabled:text-text-subtle disabled:hover:text-text-subtle"
            >
              {espera > 0
                ? `Reenviar código en ${espera} s`
                : "Reenviar código"}
            </button>

            <button
              type="button"
              onClick={onCancelar}
              className="text-center text-[13px] text-text-muted hover:text-text"
            >
              Volver a iniciar sesión
            </button>
          </form>
        </>
      )}
    </>
  );
}
