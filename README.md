# Vibe CRM

CRM para un pequeño negocio de ventas digitales: organizar clientes y no perder ventas por falta de seguimiento.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4 + Convex.
- **Diseño:** ver [`design/design.md`](./design/design.md) (tokens) y [`design/design_handoff_crm_pwa/`](./design/design_handoff_crm_pwa) (prototipo y especificación pantalla por pantalla).
- **Planificación:** equipo `Talent-academy` en Linear, proyectos **CRM-MVP** y **CRM-RESTOPRD**. Las pantallas se construyen una a una siguiendo esos tickets, no de golpe.

## Empezar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Por ahora la app solo redirige `/` → `/hoy`; las pantallas se irán añadiendo pantalla a pantalla (ver Linear).

## Conectar Convex

```bash
npx convex dev
```

Esto pide iniciar sesión (navegador) y crea/vincula un deployment de desarrollo, generando `.env.local` (no se commitea) con `NEXT_PUBLIC_CONVEX_URL`. El esquema ya está definido en [`convex/schema.ts`](./convex/schema.ts) (5 entidades del MVP: Cliente, Interacción, Seguimiento, Venta, Usuario).

## Estructura

```
convex/            Esquema y funciones de Convex
design/            Design system y prototipo de referencia (no es código a portar)
src/app/           Rutas (App Router). Grupo (app) = shell autenticado (sidebar/tabbar)
src/components/ui/ Componentes base del design system (Button, Card, Badge…)
src/components/layout/  Shell de navegación (Sidebar, MobileHeader)
src/lib/           Utilidades (cn, formato de fechas/importes, nav config)
```

## Despliegue (Railway)

El proyecto se despliega con Nixpacks (`railway.json`) usando `npm run build` / `npm run start`. Variables de entorno necesarias: ver [`.env.example`](./.env.example).
