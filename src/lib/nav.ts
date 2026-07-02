import { Home, Users, TrendingUp, Shield } from "lucide-react";

/**
 * Navegación principal (barra inferior en móvil, sidebar en escritorio).
 * "Equipo" solo debe mostrarse a usuarios con rol "propietaria" — el filtrado
 * por rol llega con la autenticación real (TAL-7 / TAL-60), de momento se
 * muestran los 4 accesos siempre.
 */
export const NAV_ITEMS = [
  { href: "/hoy", label: "Hoy", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/equipo", label: "Equipo", icon: Shield },
] as const;

export const SECTION_TITLES: Record<string, string> = {
  "/hoy": "Hoy",
  "/clientes": "Clientes",
  "/ventas": "Ventas",
  "/equipo": "Equipo",
  "/cuenta": "Mi cuenta",
};
