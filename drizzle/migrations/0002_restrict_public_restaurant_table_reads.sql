DROP POLICY IF EXISTS "public reads restaurants" ON public.restaurants;
CREATE POLICY "members read restaurant" ON public.restaurants FOR SELECT TO authenticated USING (public.is_member(id));
DROP POLICY IF EXISTS "public reads tables" ON public.tables;

CREATE OR REPLACE FUNCTION public.get_public_restaurant(_slug text)
RETURNS TABLE(id uuid, name text, slug text, address text, currency text, tax_rate numeric, service_charge_pct numeric, settings_json jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.slug, r.address, r.currency, r.tax_rate, r.service_charge_pct,
         (r.settings_json - 'stripe_account_id') AS settings_json
  FROM public.restaurants r WHERE r.slug = _slug LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant(text) TO anon, authenticated;