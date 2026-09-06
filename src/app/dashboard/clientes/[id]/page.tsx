import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/formatters";
import type { Client, Quotation } from "@/types";
import ClientDetailActions from "./ClientDetailActions";

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: clientData, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !clientData) {
    notFound();
  }

  const client = clientData as Client;

  // Fetch quotes by matching client name (since there is no client_id in quotations yet)
  const { data: quotesData } = await supabase
    .from("quotations")
    .select("*")
    .eq("client_name", client.name)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const quotes = (quotesData as Quotation[]) || [];

  // Calculate LTV (Lifetime Value) - Sum of all accepted quotes
  const ltv = quotes
    .filter((q) => q.status === "aceptada")
    .reduce((sum, q) => sum + Number(q.total), 0);

  // Total amount (all quotes)
  const totalAmount = quotes.reduce((sum, q) => sum + Number(q.total), 0);

  // Stats
  const totalQuotes = quotes.length;
  const acceptedQuotes = quotes.filter((q) => q.status === "aceptada").length;
  const winRate = totalQuotes > 0 ? ((acceptedQuotes / totalQuotes) * 100).toFixed(0) : 0;

  // Status distribution for mini chart
  const statusDist = (['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'] as const).map(status => ({
    status,
    count: quotes.filter(q => q.status === status).length,
    total: quotes.filter(q => q.status === status).reduce((sum, q) => sum + Number(q.total), 0),
  }));

  // Serialize quotes for the client component
  const serializedQuotes = quotes.map(q => ({
    id: q.id,
    number: q.number,
    total: Number(q.total),
    status: q.status,
    created_at: q.created_at,
  }));

  return (
    <ClientDetailActions
      client={client}
      quotes={serializedQuotes}
      ltv={ltv}
      totalAmount={totalAmount}
      totalQuotes={totalQuotes}
      winRate={Number(winRate)}
      statusDist={statusDist}
    />
  );
}
