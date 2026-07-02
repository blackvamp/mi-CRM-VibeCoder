import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "12 jun" a partir de una fecha ISO (YYYY-MM-DD). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${parseInt(d, 10)} ${MESES[parseInt(m, 10) - 1]}`;
}

/** "Hoy" / "Ayer" / "Hace N días" / "Hace N semanas" respecto a una fecha de referencia. */
export function relativeLabel(iso: string, today: Date = new Date()): string {
  const ref = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
  const target = new Date(iso + "T00:00:00");
  const days = Math.round((ref.getTime() - target.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.round(days / 7);
  return `Hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
}

/** Formatea un importe en euros con separador de miles por punto: 12400 -> "€12.400". */
export function formatEuro(n: number): string {
  return "€" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Normaliza un teléfono dejando solo dígitos, para comparar en búsquedas. */
export function normalizePhone(s: string): string {
  return (s || "").replace(/[^0-9]/g, "");
}

/** Iniciales de un nombre para los avatares ("Marta López" -> "ML"). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
