-- Reemplazar los UUID por los confirmados por el responsable. NO inventar.
INSERT INTO public.user_roles (user_id, role) VALUES
  ('501324e8-778d-4d7a-aa82-06daa477a683', 'admin')   -- admin@graph.com
ON CONFLICT (user_id, role) DO NOTHING;
