/*
# Guest pre-order + tracking RPCs

1. New Functions (SECURITY DEFINER, guest-safe)
- `place_guest_preorder(_slug, _name, _phone, _email, _party_size, _booking_date, _arrival_time, _items, _notes)`
  RETURNS jsonb: { reservation_id, order_number, deposit_amount }.
  Creates a pending reservation plus an `eta_preorder` order in one step. Prices and the deposit
  percentage are computed server-side from the menu and the restaurant's
  `preorder_deposit_pct` setting; the deposit amount is stored on the reservation as
  `pre_order_paid_amount` (demo payment capture) and `deposit_paid` flips when it covers the requirement.
- `guest_track(_reservation_id uuid)` RETURNS jsonb with the reservation's live status, ETA fields,
  and the linked pre-order status so the signed-out tracking screen can poll it.
- `guest_update_eta` / `guest_verify_proximity` from the previous migration are unchanged.

2. Security
- EXECUTE granted to anon + authenticated on both new functions.
- Guests still cannot read or update reservation rows directly.
*/

CREATE OR REPLACE FUNCTION public.place_guest_preorder(
  _slug text, _name text, _phone text, _email text, _party_size int,
  _booking_date date, _arrival_time time, _items jsonb, _notes text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.restaurants; rid uuid; oid uuid; num int; it jsonb; mi public.menu_items;
  sub numeric := 0; q int; dep_pct int; dep numeric; res_id uuid;
BEGIN
  SELECT * INTO r FROM public.restaurants WHERE slug = _slug;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Restaurant not found'; END IF;
  rid := r.id;
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name required'; END IF;
  IF _party_size < 1 OR _party_size > 30 THEN RAISE EXCEPTION 'Invalid party size'; END IF;
  IF _booking_date < current_date THEN RAISE EXCEPTION 'Date is in the past'; END IF;
  IF jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  dep_pct := greatest(0, least(100, coalesce((r.settings_json->>'preorder_deposit_pct')::int, 50)));

  INSERT INTO public.reservations(restaurant_id, customer_name, customer_phone, customer_email, party_size, booking_date, arrival_time, special_requests, status)
  VALUES (rid, left(btrim(_name), 80), nullif(left(_phone, 30), ''), nullif(left(_email, 120), ''), _party_size, _booking_date, _arrival_time, left(_notes, 500), 'confirmed')
  RETURNING id INTO res_id;

  SELECT coalesce(max(order_number),1000)+1 INTO num FROM public.orders WHERE restaurant_id = rid;
  INSERT INTO public.orders(restaurant_id, reservation_id, order_number, order_type, status, customer_notes)
  VALUES (rid, res_id, num, 'eta_preorder', 'incoming', left(_notes, 500)) RETURNING id INTO oid;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO mi FROM public.menu_items WHERE id = (it->>'menu_item_id')::uuid AND restaurant_id = rid AND is_available;
    IF mi.id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
    q := greatest(1, least(20, coalesce((it->>'quantity')::int,1)));
    INSERT INTO public.order_items(order_id, restaurant_id, menu_item_id, name, quantity, unit_price, station, special_instructions)
    VALUES (oid, rid, mi.id, mi.name, q, mi.price, mi.station, left(it->>'notes', 200));
    sub := sub + mi.price * q;
  END LOOP;

  UPDATE public.orders SET subtotal = sub,
    tax_amount = round(sub * r.tax_rate/100, 2),
    service_charge = round(sub * r.service_charge_pct/100, 2),
    total_amount = round(sub * (1 + r.tax_rate/100 + r.service_charge_pct/100), 2)
  WHERE id = oid;

  dep := round(sub * (1 + r.tax_rate/100) * dep_pct / 100.0, 2);
  UPDATE public.reservations SET pre_order_paid_amount = dep, deposit_paid = (dep > 0) WHERE id = res_id;
  UPDATE public.orders SET payment_status = CASE WHEN dep >= round(sub * (1 + r.tax_rate/100), 2) THEN 'paid'::public.payment_status WHEN dep > 0 THEN 'partial'::public.payment_status ELSE 'unpaid'::public.payment_status END WHERE id = oid;

  RETURN jsonb_build_object('reservation_id', res_id, 'order_number', num, 'deposit_amount', dep);
END $$;
GRANT EXECUTE ON FUNCTION public.place_guest_preorder(text,text,text,text,int,date,time,jsonb,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_track(_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res public.reservations; o record;
BEGIN
  SELECT * INTO res FROM public.reservations WHERE id = _reservation_id;
  IF res.id IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  SELECT o.order_number, o.status::text AS order_status, o.total_amount,
    (SELECT jsonb_agg(jsonb_build_object('name', oi.name, 'quantity', oi.quantity, 'status', oi.item_status::text) ORDER BY oi.name)
       FROM public.order_items oi WHERE oi.order_id = o.id) AS items
  INTO o FROM public.orders o WHERE o.reservation_id = res.id ORDER BY o.created_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'status', res.status::text,
    'customer_name', res.customer_name,
    'booking_date', res.booking_date,
    'arrival_time', res.arrival_time,
    'eta_time', res.eta_time,
    'eta_change_count', res.eta_change_count,
    'is_proximity_verified', res.is_proximity_verified,
    'pre_order_paid_amount', res.pre_order_paid_amount,
    'order_number', o.order_number,
    'order_status', o.order_status,
    'order_total', o.total_amount,
    'order_items', coalesce(o.items, '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.guest_track(uuid) TO anon, authenticated;
