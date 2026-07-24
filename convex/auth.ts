import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { ConvexError } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      // Perfil PÚBLICO del signUp: solo email/name, NUNCA rol. Así una llamada
      // maliciosa a signIn("password", { flow: "signUp" }) no puede autoasignarse
      // un rol; el único profile con rol lo produce el seed (createAccount).
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string | undefined) || undefined,
        };
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
    // Por eso el branch `existingUserId` casi nunca se ejerce con Password; se
    // mantiene por corrección (account linking).
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
