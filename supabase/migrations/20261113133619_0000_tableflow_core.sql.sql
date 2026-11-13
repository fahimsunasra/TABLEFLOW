
-- ENUMS
CREATE TYPE public.staff_role AS ENUM ('owner','manager','foh','kitchen');
CREATE TYPE public.table_zone AS ENUM ('Main Dining','Patio','Bar');
CREATE TYPE public.table_shape AS ENUM ('square','round','rectangle');
CREATE TYPE public.table_status AS ENUM ('available','reserved','occupied','waiting_food','bill_requested','cleaning');
CREATE TYPE public.kitchen_station AS ENUM ('Main Kitchen','Grill','Starters','Desserts','Bar');
CREATE TYPE public.reservation_status AS ENUM ('pending','confirmed','arriving_soon','checked_in','seated','completed','cancelled','no_show');
CREATE TYPE public.order_type AS ENUM ('qr_table','foh_pos','eta_preorder');
CREATE TYPE public.order_status AS ENUM ('incoming','accepted','preparing','ready','served','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE public.item_status AS ENUM ('pending','preparing','ready','served');
CREATE TYPE public.promo_type AS ENUM ('secret_qr','happy_hour','bogo','percentage','fixed','first_time');

-- TABLES
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  address text,
  currency text NOT NULL DEFAULT 'AUD',
  tax_rate numeric(5,2) NOT NULL DEFAULT 10,
  service_charge_pct numeric(5,2) NOT NULL DEFAULT 0,
  subscription_tier text NOT NULL DEFAULT 'trial',
  stripe_account_id text,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  role public.staff_role NOT NULL DEFAULT 'foh',
  pin_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number text NOT NULL,
  zone public.table_zone NOT NULL DEFAULT 'Main Dining',
  capacity int NOT NULL DEFAULT 4,
  shape public.table_shape NOT NULL DEFAULT 'square',
  pos_x int NOT NULL DEFAULT 0,
  pos_y int NOT NULL DEFAULT 0,
  status public.table_status NOT NULL DEFAULT 'available',
  qr_code_token text NOT NULL DEFAULT encode(gen_random_bytes(8),'hex'),
  UNIQUE (restaurant_id, table_number)
);

CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  prep_time_mins int NOT NULL DEFAULT 10,
  station public.kitchen_station NOT NULL DEFAULT 'Main Kitchen',
  image_url text,
  allergens_array text[] NOT NULL DEFAULT '{}',
  dietary_tags_array text[] NOT NULL DEFAULT '{}',
  modifiers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_available boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false
);

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  party_size int NOT NULL DEFAULT 2,
  booking_date date NOT NULL,
  arrival_time time NOT NULL,
  eta_time timestamptz,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  special_requests text,
  dietary_notes text,
  deposit_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  order_number int NOT NULL,
  order_type public.order_type NOT NULL DEFAULT 'qr_table',
  status public.order_status NOT NULL DEFAULT 'incoming',
  scheduled_fire_at timestamptz,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  service_charge numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  tip_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  customer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  modifiers_selected_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  station public.kitchen_station NOT NULL DEFAULT 'Main Kitchen',
  item_status public.item_status NOT NULL DEFAULT 'pending',
  special_instructions text
);

CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  code text,
  promo_type public.promo_type NOT NULL DEFAULT 'percentage',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  is_qr_exclusive boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  usage_count int NOT NULL DEFAULT 0
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  birthday date,
  loyalty_points int NOT NULL DEFAULT 0,
  loyalty_tier text NOT NULL DEFAULT 'Bronze',
  total_visits int NOT NULL DEFAULT 0,
  lifetime_spend numeric(12,2) NOT NULL DEFAULT 0,
  tags_array text[] NOT NULL DEFAULT '{}',
  notes text
);

CREATE TABLE public.game_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_phone text,
  game_type text NOT NULL,
  reward_title text NOT NULL,
  discount_code text,
  is_redeemed boolean NOT NULL DEFAULT false,
  expires_at timestamptz
);

-- GRANTS
GRANT SELECT ON public.restaurants, public.tables, public.menu_categories, public.menu_items TO anon;
GRANT INSERT ON public.reservations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.restaurants, public.staff_members, public.tables, public.menu_categories, public.menu_items,
  public.reservations, public.orders, public.order_items, public.promotions, public.customers, public.game_rewards
  TO authenticated;
GRANT ALL ON
  public.restaurants, public.staff_members, public.tables, public.menu_categories, public.menu_items,
  public.reservations, public.orders, public.order_items, public.promotions, public.customers, public.game_rewards
  TO service_role;

-- RLS
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rewards ENABLE ROW LEVEL SECURITY;

-- HELPERS (security definer avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_member(_rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_members
    WHERE restaurant_id = _rid AND user_id = auth.uid() AND is_active);
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(_rid uuid, _roles public.staff_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_members
    WHERE restaurant_id = _rid AND user_id = auth.uid() AND is_active AND role = ANY(_roles));
$$;

-- restaurants
CREATE POLICY "public reads restaurants" ON public.restaurants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins update restaurant" ON public.restaurants FOR UPDATE TO authenticated
  USING (public.has_staff_role(id, ARRAY['owner','manager']::public.staff_role[]))
  WITH CHECK (public.has_staff_role(id, ARRAY['owner','manager']::public.staff_role[]));
CREATE POLICY "owner deletes restaurant" ON public.restaurants FOR DELETE TO authenticated
  USING (public.has_staff_role(id, ARRAY['owner']::public.staff_role[]));

-- staff
CREATE POLICY "members read staff" ON public.staff_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(restaurant_id));
CREATE POLICY "admins manage staff" ON public.staff_members FOR ALL TO authenticated
  USING (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]))
  WITH CHECK (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]));

-- public-readable operational tables
CREATE POLICY "public reads tables" ON public.tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "members manage tables" ON public.tables FOR ALL TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));

CREATE POLICY "public reads active categories" ON public.menu_categories FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_member(restaurant_id));
CREATE POLICY "admins manage categories" ON public.menu_categories FOR ALL TO authenticated
  USING (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]))
  WITH CHECK (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]));

CREATE POLICY "public reads menu" ON public.menu_items FOR SELECT TO anon, authenticated
  USING (is_available OR public.is_member(restaurant_id));
CREATE POLICY "members update menu" ON public.menu_items FOR UPDATE TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));
CREATE POLICY "admins insert menu" ON public.menu_items FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]));
CREATE POLICY "admins delete menu" ON public.menu_items FOR DELETE TO authenticated
  USING (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]));

-- reservations: guests may only create pending bookings
CREATE POLICY "guests create reservations" ON public.reservations FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND deposit_paid = false AND table_id IS NULL AND party_size BETWEEN 1 AND 30);
CREATE POLICY "members read reservations" ON public.reservations FOR SELECT TO authenticated USING (public.is_member(restaurant_id));
CREATE POLICY "members update reservations" ON public.reservations FOR UPDATE TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));
CREATE POLICY "members delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.is_member(restaurant_id));

-- orders & items: members only; guests use place_guest_order()
CREATE POLICY "members manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));
CREATE POLICY "members manage order items" ON public.order_items FOR ALL TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));

CREATE POLICY "members manage promotions" ON public.promotions FOR ALL TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.has_staff_role(restaurant_id, ARRAY['owner','manager']::public.staff_role[]));
CREATE POLICY "members manage customers" ON public.customers FOR ALL TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));
CREATE POLICY "members manage rewards" ON public.game_rewards FOR ALL TO authenticated
  USING (public.is_member(restaurant_id)) WITH CHECK (public.is_member(restaurant_id));

-- RPC: create a restaurant and make the caller its owner
CREATE OR REPLACE FUNCTION public.create_restaurant(_name text, _slug text, _full_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.restaurants(name, slug) VALUES (_name, lower(_slug)) RETURNING id INTO rid;
  INSERT INTO public.staff_members(user_id, restaurant_id, full_name, email, role)
  VALUES (auth.uid(), rid, coalesce(nullif(_full_name,''),'Owner'), auth.jwt()->>'email', 'owner');
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.create_restaurant(text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_restaurant(text,text,text) TO authenticated;

-- RPC: first signed-in user may claim the unowned demo restaurant
CREATE OR REPLACE FUNCTION public.claim_demo_restaurant()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO rid FROM public.restaurants WHERE slug = 'bistro-aura';
  IF rid IS NULL THEN RAISE EXCEPTION 'Demo not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_members WHERE restaurant_id = rid AND role='owner' AND user_id IS NOT NULL AND user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Demo restaurant already claimed';
  END IF;
  INSERT INTO public.staff_members(user_id, restaurant_id, full_name, email, role)
  VALUES (auth.uid(), rid, coalesce(auth.jwt()->'user_metadata'->>'full_name','Demo Owner'), auth.jwt()->>'email', 'owner')
  ON CONFLICT (user_id, restaurant_id) DO NOTHING;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.claim_demo_restaurant() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_demo_restaurant() TO authenticated;

-- RPC: guest QR order; prices computed server-side from the menu
CREATE OR REPLACE FUNCTION public.place_guest_order(_slug text, _table_number text, _items jsonb, _notes text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.restaurants; tid uuid; oid uuid; num int; it jsonb; mi public.menu_items; sub numeric := 0; q int;
BEGIN
  SELECT * INTO r FROM public.restaurants WHERE slug = _slug;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Restaurant not found'; END IF;
  SELECT id INTO tid FROM public.tables WHERE restaurant_id = r.id AND table_number = _table_number;
  IF tid IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  SELECT coalesce(max(order_number),1000)+1 INTO num FROM public.orders WHERE restaurant_id = r.id;
  INSERT INTO public.orders(restaurant_id, table_id, order_number, order_type, customer_notes)
  VALUES (r.id, tid, num, 'qr_table', left(_notes, 500)) RETURNING id INTO oid;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO mi FROM public.menu_items WHERE id = (it->>'menu_item_id')::uuid AND restaurant_id = r.id AND is_available;
    IF mi.id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
    q := greatest(1, least(20, coalesce((it->>'quantity')::int,1)));
    INSERT INTO public.order_items(order_id, restaurant_id, menu_item_id, name, quantity, unit_price, station, special_instructions)
    VALUES (oid, r.id, mi.id, mi.name, q, mi.price, mi.station, left(it->>'notes', 200));
    sub := sub + mi.price * q;
  END LOOP;
  UPDATE public.orders SET subtotal = sub,
    tax_amount = round(sub * r.tax_rate/100, 2),
    service_charge = round(sub * r.service_charge_pct/100, 2),
    total_amount = round(sub * (1 + r.tax_rate/100 + r.service_charge_pct/100), 2)
  WHERE id = oid;
  UPDATE public.tables SET status = 'waiting_food' WHERE id = tid AND status IN ('available','occupied','reserved');
  RETURN num;
END $$;
GRANT EXECUTE ON FUNCTION public.place_guest_order(text,text,jsonb,text) TO anon, authenticated;

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables, public.reservations, public.orders, public.order_items;

-- SEED: Bistro Aura
DO $$
DECLARE rid uuid := gen_random_uuid();
  c_start uuid := gen_random_uuid(); c_main uuid := gen_random_uuid(); c_grill uuid := gen_random_uuid();
  c_dess uuid := gen_random_uuid(); c_bar uuid := gen_random_uuid();
  t1 uuid; t4 uuid; o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid();
  m_burrata uuid; m_risotto uuid; m_steak uuid; m_spritz uuid; m_tiramisu uuid;
BEGIN
  INSERT INTO public.restaurants(id,name,slug,address,currency,tax_rate,service_charge_pct,subscription_tier,settings_json)
  VALUES (rid,'Bistro Aura','bistro-aura','42 Rundle Street, Adelaide SA 5000','AUD',10,5,'pro',
    '{"hours":{"mon":"17:00-22:00","tue":"17:00-22:00","wed":"12:00-22:00","thu":"12:00-22:00","fri":"12:00-23:00","sat":"12:00-23:00","sun":"12:00-21:00"},"onboarding_complete":true}');

  INSERT INTO public.tables(restaurant_id,table_number,zone,capacity,shape,pos_x,pos_y,status) VALUES
  (rid,'T-01','Main Dining',2,'square',1,1,'available'),
  (rid,'T-02','Main Dining',2,'square',2,1,'occupied'),
  (rid,'T-03','Main Dining',4,'round',3,1,'reserved'),
  (rid,'T-04','Main Dining',4,'round',1,2,'waiting_food'),
  (rid,'T-05','Main Dining',6,'rectangle',2,2,'available'),
  (rid,'T-06','Main Dining',8,'rectangle',3,2,'bill_requested'),
  (rid,'T-07','Patio',2,'round',1,3,'available'),
  (rid,'T-08','Patio',4,'square',2,3,'cleaning'),
  (rid,'T-09','Patio',4,'square',3,3,'available'),
  (rid,'T-10','Bar',2,'round',1,4,'occupied'),
  (rid,'T-11','Bar',2,'round',2,4,'available'),
  (rid,'T-12','Bar',4,'rectangle',3,4,'available');
  SELECT id INTO t1 FROM public.tables WHERE restaurant_id=rid AND table_number='T-03';
  SELECT id INTO t4 FROM public.tables WHERE restaurant_id=rid AND table_number='T-04';

  INSERT INTO public.menu_categories(id,restaurant_id,name,sort_order) VALUES
  (c_start,rid,'Starters',1),(c_main,rid,'Mains',2),(c_grill,rid,'From the Grill',3),(c_dess,rid,'Desserts',4),(c_bar,rid,'Drinks',5);

  INSERT INTO public.menu_items(restaurant_id,category_id,name,description,price,prep_time_mins,station,allergens_array,dietary_tags_array,is_popular) VALUES
  (rid,c_start,'Burrata & Heirloom Tomato','Basil oil, aged balsamic, grilled sourdough',22,8,'Starters','{dairy,gluten}','{vegetarian}',true),
  (rid,c_start,'Crispy Calamari','Lemon aioli, chilli salt',19,10,'Starters','{seafood,egg}','{}',false),
  (rid,c_start,'Wagyu Beef Tartare','Cured yolk, capers, potato crisps',26,10,'Starters','{egg}','{gluten-free}',false),
  (rid,c_main,'Wild Mushroom Risotto','Truffle butter, parmesan, thyme',32,18,'Main Kitchen','{dairy}','{vegetarian,gluten-free}',true),
  (rid,c_main,'Pan-Roasted Barramundi','Fennel, saffron beurre blanc',38,16,'Main Kitchen','{fish,dairy}','{gluten-free}',false),
  (rid,c_main,'Hand-Rolled Pappardelle','Slow-braised lamb ragu, pecorino',34,15,'Main Kitchen','{gluten,dairy,egg}','{}',false),
  (rid,c_grill,'Dry-Aged Ribeye 350g','Bone marrow butter, watercress',58,22,'Grill','{dairy}','{gluten-free}',true),
  (rid,c_grill,'Free-Range Half Chicken','Chimichurri, charred lemon',36,20,'Grill','{}','{gluten-free,dairy-free}',false),
  (rid,c_grill,'Lamb Cutlets','Mint salsa verde, smoked yoghurt',44,18,'Grill','{dairy}','{gluten-free}',false),
  (rid,c_dess,'Classic Tiramisu','Mascarpone, espresso, cocoa',16,5,'Desserts','{dairy,egg,gluten}','{vegetarian}',true),
  (rid,c_dess,'Dark Chocolate Fondant','Salted caramel, vanilla gelato',18,12,'Desserts','{dairy,egg,gluten}','{vegetarian}',false),
  (rid,c_dess,'Lemon Tart','Torched meringue, berries',15,5,'Desserts','{dairy,egg,gluten}','{vegetarian}',false),
  (rid,c_bar,'Aura Spritz','Aperol, prosecco, blood orange',18,3,'Bar','{}','{vegan}',true),
  (rid,c_bar,'Espresso Martini','Vodka, fresh espresso, coffee liqueur',21,4,'Bar','{}','{vegan}',false),
  (rid,c_bar,'Barossa Shiraz (Glass)','Full-bodied, dark berries',16,1,'Bar','{sulphites}','{vegan}',false);

  SELECT id INTO m_burrata FROM public.menu_items WHERE restaurant_id=rid AND name LIKE 'Burrata%';
  SELECT id INTO m_risotto FROM public.menu_items WHERE restaurant_id=rid AND name LIKE 'Wild Mushroom%';
  SELECT id INTO m_steak FROM public.menu_items WHERE restaurant_id=rid AND name LIKE 'Dry-Aged%';
  SELECT id INTO m_spritz FROM public.menu_items WHERE restaurant_id=rid AND name='Aura Spritz';
  SELECT id INTO m_tiramisu FROM public.menu_items WHERE restaurant_id=rid AND name='Classic Tiramisu';

  INSERT INTO public.reservations(restaurant_id,table_id,customer_name,customer_phone,customer_email,party_size,booking_date,arrival_time,status,special_requests,dietary_notes,deposit_paid) VALUES
  (rid,t1,'Sophie Laurent','+61 412 555 019','sophie@example.com',4,current_date,'18:30','confirmed','Anniversary — window seat if possible',NULL,true),
  (rid,NULL,'Marcus Chen','+61 433 210 887','marcus@example.com',2,current_date,'19:00','arriving_soon',NULL,'Nut allergy',false),
  (rid,NULL,'Priya Natarajan','+61 401 998 342','priya@example.com',6,current_date,'19:30','pending','High chair needed','Vegetarian x2',false),
  (rid,NULL,'James O''Connor','+61 422 776 120','james@example.com',3,current_date,'20:00','confirmed',NULL,NULL,false),
  (rid,NULL,'Elena Rossi','+61 455 341 776','elena@example.com',8,current_date + 1,'19:00','confirmed','Birthday cake at 9pm',NULL,true),
  (rid,NULL,'Tom Whitaker','+61 499 120 554','tom@example.com',2,current_date + 1,'18:00','pending',NULL,'Gluten-free',false),
  (rid,NULL,'Aiko Tanaka','+61 470 662 019','aiko@example.com',4,current_date + 2,'20:30','confirmed',NULL,NULL,false),
  (rid,NULL,'Daniel Brooks','+61 488 300 100','dan@example.com',2,current_date - 1,'19:00','completed',NULL,NULL,false);

  INSERT INTO public.orders(id,restaurant_id,table_id,order_number,order_type,status,subtotal,tax_amount,service_charge,total_amount,created_at) VALUES
  (o1,rid,t4,1001,'qr_table','preparing',94,9.4,4.7,108.1, now() - interval '12 minutes'),
  (o2,rid,(SELECT id FROM public.tables WHERE restaurant_id=rid AND table_number='T-10'),1002,'foh_pos','incoming',36,3.6,1.8,41.4, now() - interval '2 minutes');
  INSERT INTO public.order_items(order_id,restaurant_id,menu_item_id,name,quantity,unit_price,station,item_status) VALUES
  (o1,rid,m_burrata,'Burrata & Heirloom Tomato',1,22,'Starters','ready'),
  (o1,rid,m_steak,'Dry-Aged Ribeye 350g',1,58,'Grill','preparing'),
  (o1,rid,m_spritz,'Aura Spritz',1,18,'Bar','served'),
  (o2,rid,m_risotto,'Wild Mushroom Risotto',1,32,'Main Kitchen','pending'),
  (o2,rid,m_tiramisu,'Classic Tiramisu',1,16,'Desserts','pending');
  UPDATE public.orders SET subtotal=48, tax_amount=4.8, service_charge=2.4, total_amount=55.2 WHERE id=o2;

  INSERT INTO public.staff_members(restaurant_id,full_name,role,pin_code) VALUES
  (rid,'Olivia Grant','manager','1234'),(rid,'Liam Patel','foh','2468'),(rid,'Chef Marco Bellini','kitchen','1357');

  INSERT INTO public.promotions(restaurant_id,title,code,promo_type,discount_value,min_order_amount,is_qr_exclusive) VALUES
  (rid,'QR Table Secret — 10% off','AURA10','secret_qr',10,40,true),
  (rid,'Happy Hour Spritz','HAPPY5','happy_hour',5,0,false),
  (rid,'Welcome — first visit','WELCOME15','first_time',15,50,false);

  INSERT INTO public.customers(restaurant_id,full_name,email,phone,loyalty_points,loyalty_tier,total_visits,lifetime_spend,tags_array) VALUES
  (rid,'Sophie Laurent','sophie@example.com','+61 412 555 019',1240,'Gold',14,1860,'{regular,wine-lover}'),
  (rid,'Marcus Chen','marcus@example.com','+61 433 210 887',320,'Silver',5,540,'{nut-allergy}'),
  (rid,'Elena Rossi','elena@example.com','+61 455 341 776',2100,'Platinum',22,3400,'{vip,events}');
END $$;
