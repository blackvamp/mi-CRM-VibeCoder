import { guardAuth } from "@/lib/authGuard";
import { Proximamente } from "@/components/Proximamente";

// Next.js 16: `params` es asíncrono. La ficha real llega en TAL-11/TAL-14; por
// ahora es un placeholder para que "tocar un seguimiento" en Hoy no dé 404.
export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardAuth();
  await params;
  return <Proximamente titulo="Ficha de cliente" />;
}
