import { createClient } from "@/lib/supabase/server";
import ClientTable from "./ClientTable";
import type { Client } from "@/types";
import { unwrapList } from "@/lib/supabase/unwrap";

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const supabase = createClient();

  const [clientsRes, quotationsRes] = await Promise.all([
    supabase.from("clients").select("*").order("name", { ascending: true }),
    supabase.from("quotations").select("client_name, total, status, created_at").is("deleted_at", null),
  ]);

  const clients = unwrapList<Client>(clientsRes as any, "clientes.list");
  const quotations = unwrapList(quotationsRes as any, "clientes.quotations") as Array<{
    client_name: string;
    total: number;
    status: string;
    created_at: string;
  }>;

  // Enrich clients with stats
  const clientsWithStats = clients.map(c => {
    const clientQuotes = quotations.filter(q => q.client_name === c.name);
    const ltv = clientQuotes
      .filter(q => q.status === "aceptada")
      .reduce((sum, q) => sum + Number(q.total), 0);
    const lastQuote = clientQuotes.length > 0
      ? clientQuotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
    return {
      ...c,
      quoteCount: clientQuotes.length,
      ltv,
      lastQuoteDate: lastQuote?.created_at || undefined,
    };
  });

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Directorio de Clientes</h1>
          <p className="subtitle">{clients.length} clientes registrados</p>
        </div>
      </div>
      <div className="page-body">
        <ClientTable initialClients={clientsWithStats} />
      </div>
    </div>
  );
}
