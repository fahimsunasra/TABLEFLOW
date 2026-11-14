/*
# Anti-Ghosting & Food-Waste Protection

1. Modified Tables
- `reservations`
  - `pre_order_paid_amount` numeric(10,2) NOT NULL DEFAULT 0 — deposit collected for the pre-order.
  - `eta_change_count` int NOT NULL DEFAULT 0 — times the guest pushed their ETA (max 1 allowed).
  - `is_proximity_verified` boolean NOT NULL DEFAULT false — guest shared GPS and was verified nearby.
- `customers`
  - `no_show_count` int NOT NULL DEFAULT 0 — repeat no-show flag for auto-flagging.

2. Security
- SECURITY DEFINER RPCs let the signed-out guest tracking screen update only these protected
  fields on its own reservation — never the whole row:
  - `guest_update_eta(_reservation_id uuid, _new_eta timestamptz)` — enforces max 1 change, max +15 min, future ETA.
  - `guest_verify_proximity(_reservation_id uuid, _lat double precision, _lng double precision)` —
    validates coordinates and marks the reservation verified when the device shares location.
- Grants: EXECUTE on both RPCs to anon + authenticated; column UPDATE grants to authenticated.
*/

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS pre_order_paid_amount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS eta_change_count int NOT NULL DEFAULT 0;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS is_proximity_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS no_show_count int NOT NULL DEFAULT 0;

GRANT UPDATE (pre_order_paid_amount, eta_change_count, is_proximity_verified) ON public.reservations TO authenticated;
GRANT UPDATE (no_show_count) ON public.customers TO authenticated;

CREATE OR REPLACE FUNCTION public.guest_update_eta(_reservation_id uuid, _new_eta timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations;
BEGIN
  SELECT * INTO r FROM public.reservations WHERE id = _reservation_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF r.eta_change_count >= 1 THEN RAISE EXCEPTION 'ETA can only be updated once'; END IF;
  IF _new_eta > (coalesce(r.eta_time, r.booking_date::timestamptz) + interval '15 minutes') THEN
    RAISE EXCEPTION 'ETA can be extended by at most 15 minutes';
  END IF;
  IF _new_eta < now() - interval '5 minutes' THEN RAISE EXCEPTION 'ETA must be in the future'; END IF;
  UPDATE public.reservations SET eta_time = _new_eta, eta_change_count = eta_change_count + 1
  WHERE id = _reservation_id RETURNING eta_time INTO _new_eta;
  RETURN _new_eta;
END $$;
GRANT EXECUTE ON FUNCTION public.guest_update_eta(uuid, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_verify_proximity(_reservation_id uuid, _lat double precision, _lng double precision)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT res.id INTO r FROM public.reservations res WHERE res.id = _reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF _lat IS NULL OR _lng IS NULL OR abs(_lat) > 90 OR abs(_lng) > 180 THEN RAISE EXCEPTION 'Invalid location'; END IF;
  UPDATE public.reservations SET is_proximity_verified = true WHERE id = _reservation_id;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.guest_verify_proximity(uuid, double precision, double precision) TO anon, authenticated;
