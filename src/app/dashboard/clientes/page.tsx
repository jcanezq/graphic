import { createClient } from "@/lib/supabase/server";
import ClientTable from "./ClientTable";
import type { Client } from "@/types";

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  const clients = (data as Client[]) || [];

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Directorio de Clientes</h1>
          <p className="subtitle">{clients.length} clientes registrados</p>
        </div>
      </div>
      <div className="page-body">
        <ClientTable initialClients={clients} />
      </div>
    </div>
  );
}
