"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RecuperarContrasena } from "./RecuperarContrasena";

// Mensaje deliberadamente genérico: Convex Auth no propaga a través del
// redirect el motivo exacto del fallo (evita filtrar si un email existe o
// no), así que no distinguimos "cuenta no autorizada" de "cancelaste en
// Google" ni de un error del proveedor.
const ERROR_GOOGLE = "No se pudo iniciar sesión con Google.";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  // Modo recuperación: se renderiza en LUGAR del formulario de acceso, no junto
  // a él. El enlace que lo activa vive dentro de ese <form>, así que mostrar los
  // dos a la vez anidaría formularios.
  const [modo, setModo] = useState<"login" | "recuperar">("login");
  // El correo ya escrito se copia al pasar a recuperación para no obligar a
  // teclearlo otra vez. Se lee en el clic porque después el input se desmonta.
  const emailRef = useRef<HTMLInputElement>(null);
  const [emailRecuperacion, setEmailRecuperacion] = useState("");
  // `signIn("google")` solo abre el redirect a Google; el resultado (éxito o
  // rechazo de createOrUpdateUser) llega en la carga de página siguiente, no
  // como una excepción capturable en onGoogleClick. Se detecta leyendo el
  // marcador propio de la URL en el primer render: si vino `code`, es un
  // regreso exitoso (el `code` se consume aparte y dispara el redirect de
  // abajo); si no, fue un rechazo.
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("intento") === "google" && !params.has("code")
      ? ERROR_GOOGLE
      : null;
  });

  // Sesión iniciada (login por contraseña o regreso exitoso de Google) → a /hoy.
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/hoy");
    }
  }, [isAuthenticated, router]);

  // Limpieza de la URL: quitar el marcador `intento` una vez leído, para que
  // recargar /login no vuelva a mostrar un intento anterior como error actual.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("intento")) {
      url.searchParams.delete("intento");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    // Solo iniciamos sesión: nunca exponemos el flujo de registro en la UI.
    form.set("flow", "signIn");
    setSubmitting(true);
    try {
      await signIn("password", form);
      router.replace("/hoy");
    } catch {
      setError("Correo o contraseña incorrectos.");
      setSubmitting(false);
    }
  }

  async function onGoogleClick() {
    setError(null);
    setSubmittingGoogle(true);
    try {
      await signIn("google", { redirectTo: "/login?intento=google" });
    } catch {
      setError(ERROR_GOOGLE);
      setSubmittingGoogle(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-primary text-[17px] font-semibold text-on-primary">
            V
          </span>
          <span className="text-lg font-semibold text-text">Vibe CRM</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {modo === "recuperar" ? (
            <RecuperarContrasena
              emailInicial={emailRecuperacion}
              onCancelar={() => setModo("login")}
            />
          ) : (
            <>
          <h1 className="text-xl font-semibold text-text">Inicia sesión</h1>
          <p className="mt-1 text-sm text-text-muted">
            Entra para ver tus tareas del día.
          </p>

          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
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
              ref={emailRef}
            />

            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPass}
                className="absolute right-2 top-[34px] flex size-9 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2"
              >
                {showPass ? (
                  <EyeOff className="size-[18px]" aria-hidden />
                ) : (
                  <Eye className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>

            <Button type="submit" loading={submitting} className="w-full">
              Entrar
            </Button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setEmailRecuperacion(emailRef.current?.value ?? "");
                setModo("recuperar");
              }}
              className="text-center text-[13px] text-text-muted hover:text-text"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[12px] text-text-subtle">o</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onGoogleClick}
            loading={submittingGoogle}
            className="w-full"
          >
            Entrar con Google
          </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
