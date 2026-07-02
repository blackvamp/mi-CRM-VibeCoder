import { guardAuth } from "@/lib/authGuard";
import { Proximamente } from "@/components/Proximamente";

export default async function ClientesPage() {
  await guardAuth();
  return <Proximamente titulo="Lista de clientes" />;
}
