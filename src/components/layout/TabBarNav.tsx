"use client";

import { TabBar } from "@/components/ui/TabBar";
import { useNavItems } from "@/lib/useSesion";

/** Barra inferior móvil con los ítems filtrados por rol (Equipo solo dueña). */
export function TabBarNav({ className }: { className?: string }) {
  const items = useNavItems();
  return <TabBar items={items} className={className} />;
}
