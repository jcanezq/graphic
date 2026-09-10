const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://msoqsownjljenbxoeait.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb3Fzb3duamxqZW5ieG9lYWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODE5NDY1NSwiZXhwIjoyMTAzNzcwNjU1fQ.ENED8Lvz6lxTYTMX17US1x9ae4zqv0uTGmwvFab2WSo'
);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql_hack', { sql: `
    SELECT count(*) AS filas,
           round(sum(subtotal)::numeric, 2) AS suma_items,
           (SELECT round(sum(total)::numeric, 2) FROM quotations WHERE deleted_at IS NULL) AS suma_totales
      FROM quotation_items;
  ` });
  
  if (error) {
    // We probably don't have execute_sql_hack. Let's do it via PostgREST if we can't do raw SQL.
    // Wait, Supabase client can't run raw SQL easily without RPC.
    console.log("No RPC available for raw SQL.");
    
    // Instead, query the data directly and sum it here.
    console.log("Fetching rows to calculate sums...");
    
    const { data: qitems, error: qErr } = await supabase.from('quotation_items').select('subtotal');
    const { data: quotes, error: qtErr } = await supabase.from('quotations').select('total').is('deleted_at', null);
    
    if (qErr || qtErr) {
      console.error(qErr || qtErr);
      return;
    }
    
    let suma_items = 0;
    for(const i of qitems) suma_items += Number(i.subtotal);
    
    let suma_totales = 0;
    for(const q of quotes) suma_totales += Number(q.total);
    
    console.log({
      filas: qitems.length,
      suma_items: suma_items.toFixed(2),
      suma_totales: suma_totales.toFixed(2)
    });
  } else {
    console.log(data);
  }
}

run();
