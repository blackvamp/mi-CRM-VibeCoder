import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { ConvexError } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { CodigoRecuperacion } from "./codigoRecuperacion";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      // Perfil PÚBLICO del signUp: solo email/name, NUNCA rol. Así una llamada
      // maliciosa a signIn("password", { flow: "signUp" }) no puede autoasignarse
      // un rol; el único profile con rol lo produce el seed (createAccount).
      //
      // El correo se normaliza AQUÍ porque este es el punto único desde el que
      // la librería lo lee: los cuatro flujos (signUp, signIn, reset y
      // reset-verification) localizan la cuenta con el `email` que devuelve este
      // profile. Sin esta normalización, escribir " Admin@X.com " en la pantalla
      // de recuperación no encontraría la cuenta y la persona esperaría un
      // correo que nunca sale.
      profile(params) {
        return {
          email: (params.email as string).trim().toLowerCase(),
          name: (params.name as string | undefined) || undefined,
        };
      },
      // Código de un solo uso para recuperar la contraseña (TAL-65). Va SOLO
      // aquí: si además se registrara en `providers[]`, el código valdría como
      // login sin contraseña y no invalidaría las sesiones abiertas.
      reset: CodigoRecuperacion,
      // Mismo umbral que el validador por defecto de la librería (8), pero con
      // ConvexError y texto en español para que `mensajeError` lo muestre tal
      // cual en vez de caer en el mensaje genérico. Se ejecuta ANTES de
      // verificar el código, así que una contraseña corta no lo consume.
      validatePasswordRequirements: (password: string) => {
        if (password.length < 8) {
          throw new ConvexError(
            "La contraseña debe tener al menos 8 caracteres.",
          );
        }
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    // Regla de aprovisionamiento (no "rechazar toda creación", que bloquearía el
    // propio seed): se crea un usuario nuevo SOLO si el profile trae un rol
    // válido, y ese rol solo lo produce el seed interno vía createAccount.
    //
    // Nota: con el proveedor Password, el sign-in normal NO pasa por este
    // callback (solo se invoca al CREAR cuenta: signUp público o createAccount).
    //
    // El branch `existingUserId` SÍ se ejerce: la recuperación de contraseña
    // (TAL-65) entra por aquí DOS veces —al crear el código y al verificarlo—
    // siempre con `existingUserId` distinto de null. El return temprano es lo
    // que deja `rol` y `name` intactos durante el reset: quitarlo rompería la
    // recuperación en silencio (el usuario perdería su rol y `requireUsuario`
    // empezaría a rechazarlo).
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId !== null) {
        return args.existingUserId;
      }
      const profile = args.profile as Record<string, unknown>;

      // Google: registro cerrado por diseño también aquí. Con un
      // createOrUpdateUser personalizado, Convex Auth NO enlaza
      // automáticamente por email (esa lógica solo existe en su
      // implementación por defecto), así que lo hacemos a mano: solo se
      // permite entrar si el email ya pertenece a un usuario provisionado
      // (con rol) por el seed. Nunca se crea un usuario nuevo desde OAuth.
      // (Cubre específicamente Google; otro proveedor OAuth futuro debe
      // evaluarse por separado antes de reusar esta rama.)
      if (args.type === "oauth") {
        const email =
          typeof profile.email === "string" ? profile.email : undefined;
        // `ctx` llega tipado por la librería como GenericMutationCtx<AnyDataModel>,
        // que no conoce el índice `email` de nuestro `users`. En tiempo de
        // ejecución es, literalmente, el MutationCtx real de este deployment
        // (se invoca dentro de la mutation `auth:store`), así que el cast es
        // seguro.
        const db = (ctx as unknown as MutationCtx).db;
        const existente =
          email !== undefined
            ? await db
                .query("users")
                .withIndex("email", (q) => q.eq("email", email))
                .unique()
            : null;
        if (existente === null || existente.rol === undefined) {
          throw new ConvexError(
            "Cuenta de Google no provisionada: no coincide con ningún usuario autorizado.",
          );
        }
        return existente._id;
      }

      const rol = profile.rol;
      if (rol !== "propietaria" && rol !== "comercial") {
        throw new ConvexError("Registro no permitido");
      }
      return await ctx.db.insert("users", {
        email: typeof profile.email === "string" ? profile.email : undefined,
        name: typeof profile.name === "string" ? profile.name : undefined,
        rol,
      });
    },
  },
});
