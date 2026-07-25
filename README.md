# Vibe CRM

CRM para un pequeño negocio de ventas digitales: organizar clientes y no perder ventas por falta de seguimiento.

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Convex (+ Convex Auth).
- **Diseño:** ver [`design/design.md`](./design/design.md) (tokens) y [`design/design_handoff_crm_pwa/`](./design/design_handoff_crm_pwa) (prototipo y especificación pantalla por pantalla).
- **Planificación:** equipo `Talent-academy` en Linear, proyectos **CRM-MVP** y **CRM-RESTOPRD**.

## Empezar en local

```bash
npm install
npx convex dev      # backend: vincula/crea el deployment y genera .env.local
npm run dev         # frontend: http://localhost:3000
```

Hacen falta los dos procesos a la vez (Convex y Next). El primer `npx convex dev` pide login e inicializa el deployment; a partir de ahí `convex/_generated` y `.env.local` (con `NEXT_PUBLIC_CONVEX_URL`) quedan listos.

### Usuarios (seed dev)

El registro público está cerrado a propósito. Los usuarios se crean con una función interna (dev-only):

```bash
npx convex run seed:sembrarUsuarios '{"martaPassword":"<pass>","carlosPassword":"<pass>"}'
```

Crea `admin@talent-network.org` (dueña) y `carlos@vibecrm.local` (comercial). Luego entra en `/login` con contraseña, o con Google si ese email ya está provisionado.

### Soporte (funciones internas, solo por CLI)

```bash
# Devuelve el acceso a alguien bloqueado por intentos fallidos (login y/o código).
# Borra las dos claves de authRateLimits y la cuota de solicitudes; devuelve
# cuántas filas ha borrado de cada tipo.
npx convex run soporte:desbloquearAcceso '{"email":"alguien@dominio.com"}'

# Diagnóstico: correos guardados que no están en minúsculas y sin espacios.
# Lista vacía = todo correcto. Conviene ejecutarlo antes de cada despliegue.
npx convex run soporte:revisarCorreos
```

Hace falta la primera porque los límites de intentos de Convex Auth se pueden agotar desde fuera sin autenticarse: diez contraseñas equivocadas dejan una cuenta sin login durante ~1 h, y diez canjes fallidos hacen lo propio con el código de recuperación (ver TAL-67).

## Estructura

```
convex/            Esquema, funciones y auth de Convex (_generated SÍ se versiona)
design/            Design system y prototipo de referencia (no es código a portar)
src/app/           Rutas (App Router). (app) = shell autenticado, (auth) = login
src/proxy.ts       Proxy (antes «middleware») — redirección optimista de sesión
src/components/    UI del design system, layout (sidebar/tabbar) y overlays
src/lib/           Utilidades (fechas locales, api de Convex, guard de auth, nav)
```

## Seguridad / auth (resumen)

- **Convex Auth** con proveedores Password y Google. Google solo enlaza por email a un usuario ya provisionado (con `rol`) y con el correo verificado por el proveedor; nunca crea cuentas. La tabla `users` lleva `rol` (`propietaria` | `comercial`).
- Defensa en capas: `src/proxy.ts` (redirección optimista) + `guardAuth()` server-side por página + `requireUsuario()` en cada función Convex (exige sesión y rol válido). El registro público no puede autoasignarse rol.
- `/equipo` comprueba el rol server-side (solo la dueña).
- `auth:signIn` es una action **pública**: `Password.profile()` solo admite los flujos `signIn`, `reset` y `reset-verification`. En particular `signUp` está cerrado, porque con la cuenta ya creada ese camino comparaba contraseñas **sin pasar por el límite de intentos** (TAL-66).
- Duración de sesión, caducidad del JWT y número de intentos están **declarados** en `convex/auth.ts`, no heredados de la librería.

### Variables de entorno sensibles (Convex)

- `RECUPERACION_SECRETO` es imprescindible: sin ella no se emite ningún código de recuperación (fail-closed) y queda registrado `recuperacion: falta RECUPERACION_SECRETO` en los logs.
- `AUTH_LOG_LEVEL` **nunca** en `DEBUG` en producción: ese nivel registra el código de recuperación en claro. Tampoco `AUTH_LOG_SECRETS=true`.

## Despliegue

### Backend — Convex (se despliega aparte)

```bash
npx convex deploy            # despliega funciones + esquema al deployment de producción
```

En ese deployment de producción hay que dejar configurado **Convex Auth** una sola vez:

```bash
npx @convex-dev/auth --prod --web-server-url https://<tu-dominio-railway>
```

Esto fija `SITE_URL`, `JWT_PRIVATE_KEY` y `JWKS` en producción. `SITE_URL` debe ser el dominio público (el de Railway).

Para que el login con Google funcione en ese deployment, además hace falta:

```bash
npx convex env set AUTH_GOOGLE_ID <client-id>
npx convex env set AUTH_GOOGLE_SECRET <client-secret>
```

La redirect URI que hay que dar de alta en Google es `<dominio-.convex.site del deployment>/api/auth/callback/google`.

### Frontend — Railway (publicación automática desde GitHub)

Railway construye con Nixpacks (`railway.json`): `npm run build` → `npm run start` (Next.js respeta la variable `PORT`). En **Variables** de Railway define:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | URL del deployment de Convex de producción (`https://<algo>.convex.cloud`) |

Con GitHub conectado, cada push a `main` dispara build + deploy. `convex/_generated` está versionado, así que `npm run build` es reproducible sin credenciales de Convex.

> **Nota:** con esta configuración el backend Convex NO se despliega desde Railway; actualízalo con `npx convex deploy` cuando cambien las funciones o el esquema.
