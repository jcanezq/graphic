-- A-01
SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.clients'::regclass;
-- A-02
SELECT column_name, data_type, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_name = 'clients' ORDER BY ordinal_position;
-- A-03
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'clients';
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'clients';
SELECT tgname FROM pg_trigger WHERE tgrelid='public.clients'::regclass AND NOT tgisinternal;
-- A-04
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.quotations'::regclass AND contype = 'c';
-- A-05
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
-- A-06
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig, p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('replace_quotation_items','generate_quotation_number');
-- A-07
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY tablename, policyname;
-- A-08
SELECT count(*) AS filas FROM public.company_settings;
-- A-09
SELECT count(*) AS filas_con_null FROM public.quotation_items WHERE has_labor IS NULL OR has_design IS NULL OR has_transport IS NULL OR design_cost IS NULL OR transport_cost IS NULL;
-- A-10
SELECT count(*) FILTER (WHERE quantity <= 0) AS qty_invalida, count(*) FILTER (WHERE unit_price < 0) AS precio_negativo, count(*) FILTER (WHERE subtotal < 0) AS subtotal_negativo, count(*) FILTER (WHERE margin_percent NOT BETWEEN -100 AND 1000) AS margen_fuera_rango FROM public.quotation_items;
SELECT count(*) FILTER (WHERE igv_rate NOT BETWEEN 0 AND 1) AS igv_fuera_rango, count(*) FILTER (WHERE validity_days <= 0) AS validez_invalida, count(*) FILTER (WHERE subtotal < 0 OR igv < 0 OR total < 0) AS montos_negativos FROM public.quotations;
SELECT DISTINCT type FROM public.products;
-- A-11
SELECT count(*) AS huerfanos FROM public.quotations q WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = q.user_id);
-- A-12
SELECT id, email, created_at FROM auth.users ORDER BY created_at;
-- A-13
SELECT count(*) FILTER (WHERE labor_unit_cost <> round(labor_unit_cost, 2)) AS labor, count(*) FILTER (WHERE design_unit_cost <> round(design_unit_cost, 2)) AS design, count(*) FILTER (WHERE transport_unit_cost <> round(transport_unit_cost, 2)) AS transporte, count(*) FILTER (WHERE labor_quantity <> round(labor_quantity, 4)) AS cant_labor, count(*) FILTER (WHERE design_quantity <> round(design_quantity, 4)) AS cant_design, count(*) FILTER (WHERE transport_quantity <> round(transport_quantity, 4)) AS cant_transp FROM public.quotation_items;
-- A-14
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'quotation_items' ORDER BY ordinal_position;
