const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://msoqsownjljenbxoeait.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb3Fzb3duamxqZW5ieG9lYWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODE5NDY1NSwiZXhwIjoyMTAzNzcwNjU1fQ.ENED8Lvz6lxTYTMX17US1x9ae4zqv0uTGmwvFab2WSo'
);
async function run() {
  const { data, error } = await supabase.from('quotation_items').select('*').limit(1);
  console.log(Object.keys(data[0] || {}));
}
run();
