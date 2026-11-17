ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS kitchen_delay_minutes integer NOT NULL DEFAULT 0 CHECK (kitchen_delay_minutes IN (0,5));
CREATE OR REPLACE FUNCTION public.foh_manual_order(_restaurant_id uuid, _table_id uuid, _items jsonb, _notes text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.restaurants; o uuid; num integer; it jsonb; mi public.menu_items; q integer; sub numeric:=0;
BEGIN
IF NOT has_staff_role(_restaurant_id, ARRAY['owner','manager','foh']::staff_role[]) THEN RAISE EXCEPTION 'Access denied'; END IF;
SELECT * INTO r FROM restaurants WHERE id=_restaurant_id FOR UPDATE;
IF NOT EXISTS(SELECT 1 FROM tables WHERE id=_table_id AND restaurant_id=_restaurant_id AND merged_into IS NULL) THEN RAISE EXCEPTION 'Table unavailable'; END IF;
IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
SELECT coalesce(max(order_number),1000)+1 INTO num FROM orders WHERE restaurant_id=_restaurant_id;
INSERT INTO orders(restaurant_id,table_id,order_number,order_type,customer_notes) VALUES(_restaurant_id,_table_id,num,'foh_pos',left(_notes,500)) RETURNING id INTO o;
FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
SELECT * INTO mi FROM menu_items WHERE id=(it->>'menu_item_id')::uuid AND restaurant_id=_restaurant_id AND is_available FOR SHARE;
IF mi.id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
q:=(it->>'quantity')::integer; IF q IS NULL OR q NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
INSERT INTO order_items(order_id,restaurant_id,menu_item_id,name,quantity,unit_price,station,special_instructions) VALUES(o,_restaurant_id,mi.id,mi.name,q,mi.price,mi.station,left(_notes,200)); sub:=sub+mi.price*q;
END LOOP;
UPDATE orders SET subtotal=sub,tax_amount=round(sub*r.tax_rate/100,2),service_charge=round(sub*r.service_charge_pct/100,2),total_amount=round(sub*(1+r.tax_rate/100+r.service_charge_pct/100),2) WHERE id=o;
UPDATE tables SET status='waiting_food' WHERE id=_table_id; RETURN num;
END $$;
CREATE OR REPLACE FUNCTION public.foh_reservation_action(_restaurant_id uuid,_reservation_id uuid,_table_id uuid,_fire boolean,_scheduled_fire_at text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.reservations;
BEGIN
IF NOT has_staff_role(_restaurant_id,ARRAY['owner','manager','foh']::staff_role[]) THEN RAISE EXCEPTION 'Access denied'; END IF;
SELECT * INTO b FROM reservations WHERE id=_reservation_id AND restaurant_id=_restaurant_id FOR UPDATE;
IF b.id IS NULL OR b.status IN ('completed','cancelled','no_show') THEN RAISE EXCEPTION 'Reservation unavailable'; END IF;
PERFORM 1 FROM tables WHERE id=_table_id AND restaurant_id=_restaurant_id AND merged_into IS NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Table unavailable'; END IF;
IF EXISTS(SELECT 1 FROM reservations WHERE table_id=_table_id AND id<>_reservation_id AND status IN ('confirmed','arriving_soon','checked_in','seated') AND booking_date=b.booking_date) OR EXISTS(SELECT 1 FROM tables WHERE id=_table_id AND status NOT IN ('available','reserved') AND b.table_id IS DISTINCT FROM _table_id) THEN RAISE EXCEPTION 'Table already assigned'; END IF;
IF EXISTS(SELECT 1 FROM tables WHERE id=_table_id AND capacity<b.party_size) THEN RAISE EXCEPTION 'Table too small'; END IF;
UPDATE reservations SET table_id=_table_id,status=CASE WHEN _fire THEN 'seated'::reservation_status ELSE 'confirmed'::reservation_status END WHERE id=b.id;
UPDATE tables SET status=CASE WHEN _fire THEN 'waiting_food'::table_status ELSE 'reserved'::table_status END WHERE id=_table_id;
UPDATE orders SET table_id=_table_id,status=CASE WHEN _fire THEN 'incoming'::order_status ELSE 'accepted'::order_status END, fired_manually=_fire,scheduled_fire_at=CASE WHEN _fire THEN NULL ELSE _scheduled_fire_at::timestamptz END WHERE reservation_id=b.id AND restaurant_id=_restaurant_id AND status IN ('incoming','accepted');
END $$;
CREATE OR REPLACE FUNCTION public.foh_pay_bill(_restaurant_id uuid,_table_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT has_staff_role(_restaurant_id,ARRAY['owner','manager','foh']::staff_role[]) THEN RAISE EXCEPTION 'Access denied'; END IF;
UPDATE orders SET payment_status='paid' WHERE restaurant_id=_restaurant_id AND table_id=_table_id AND status<>'cancelled' AND payment_status<>'paid';
UPDATE reservations SET status='completed' WHERE restaurant_id=_restaurant_id AND table_id=_table_id AND status='seated';
UPDATE tables SET status='cleaning' WHERE id=_table_id AND restaurant_id=_restaurant_id;
END $$;
CREATE OR REPLACE FUNCTION public.set_kitchen_delay(_restaurant_id uuid,_minutes integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT has_staff_role(_restaurant_id,ARRAY['owner','manager','kitchen']::staff_role[]) THEN RAISE EXCEPTION 'Access denied'; END IF;
IF _minutes NOT IN (0,5) THEN RAISE EXCEPTION 'Invalid delay'; END IF;
UPDATE restaurants SET kitchen_delay_minutes=_minutes WHERE id=_restaurant_id;
END $$;
REVOKE ALL ON FUNCTION public.foh_manual_order(uuid,uuid,jsonb,text),public.foh_reservation_action(uuid,uuid,uuid,boolean,text),public.foh_pay_bill(uuid,uuid),public.set_kitchen_delay(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.foh_manual_order(uuid,uuid,jsonb,text),public.foh_reservation_action(uuid,uuid,uuid,boolean,text),public.foh_pay_bill(uuid,uuid),public.set_kitchen_delay(uuid,integer) TO authenticated,service_role;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='menu_items') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; END IF; IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='restaurants') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants; END IF; END $$;