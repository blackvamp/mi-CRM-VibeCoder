import { guardAuth } from "@/lib/authGuard";
import { Proximamente } from "@/components/Proximamente";

export default async function VentasPage() {
  await guardAuth();
  return <Proximamente titulo="Ventas y oportunidades" />;
}
