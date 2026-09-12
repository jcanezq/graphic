import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const qRes = await fetch(`${url}/rest/v1/quotations?order=created_at.desc&limit=5`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const qs = await qRes.json();
  const quotation = qs.find(q => q.number && q.number.includes('22'));
  if (!quotation) { console.log("Quotation 22 not found"); return; }

  const iRes = await fetch(`${url}/rest/v1/quotation_items?quotation_id=eq.${quotation.id}&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const items = await iRes.json();
  
  for (const item of items) {
    console.log(`\n---------------------------------`);
    console.log(`Quotation Item: ${item.product_name}`);
    console.log(`Unit Cost in Quotation: ${item.unit_cost}`);
    
    if (item.product_id) {
       const [pRes, mRes, lRes, icRes] = await Promise.all([
         fetch(`${url}/rest/v1/products?id=eq.${item.product_id}&select=*`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }),
         fetch(`${url}/rest/v1/product_materials?product_id=eq.${item.product_id}&select=*`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }),
         fetch(`${url}/rest/v1/product_labor?product_id=eq.${item.product_id}&select=*`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }),
         fetch(`${url}/rest/v1/product_indirect_costs?product_id=eq.${item.product_id}&select=*`, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } })
       ]);
       
       const p = await pRes.json();
       const materials = await mRes.json();
       const labor = await lRes.json();
       const indirects = await icRes.json();
       
       let calculatedCost = p[0]?.manual_unit_cost || 0;
       console.log(`Base Manual Cost: ${calculatedCost}`);
       
       if (materials.length > 0) {
           console.log(` Materials:`);
           for(let m of materials) {
               const cost = m.quantity * m.unit_cost;
               calculatedCost += cost;
               console.log(`  - ${m.name}: ${m.quantity} x ${m.unit_cost} = ${cost}`);
           }
       }
       if (labor.length > 0) {
           console.log(` Labor:`);
           for(let l of labor) {
               const cost = l.hours * l.hourly_rate;
               calculatedCost += cost;
               console.log(`  - ${l.work_type}: ${l.hours} x ${l.hourly_rate} = ${cost}`);
           }
       }
       if (indirects.length > 0) {
           console.log(` Indirects:`);
           for(let i of indirects) {
               calculatedCost += i.cost;
               console.log(`  - ${i.concept}: ${i.cost}`);
           }
       }
       console.log(`Total Calculated DB Cost: ${calculatedCost}`);
       console.log(`Difference (Quotation - DB): ${item.unit_cost - calculatedCost}`);
    }
  }
}
run().catch(console.error);
