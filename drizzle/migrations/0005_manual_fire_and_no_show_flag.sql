ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fired_manually boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.track_no_show()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE flag boolean;
BEGIN
  IF NEW.status = 'no_show' AND OLD.status IS DISTINCT FROM 'no_show' AND NEW.customer_phone IS NOT NULL THEN
    SELECT coalesce((settings_json->>'auto_flag_no_show')::boolean, false) INTO flag FROM public.restaurants WHERE id = NEW.restaurant_id;
    UPDATE public.customers SET no_show_count = no_show_count + 1,
      tags_array = CASE WHEN flag AND no_show_count + 1 >= 2 AND NOT ('Repeat No-Show' = ANY(tags_array))
        THEN array_append(tags_array, 'Repeat No-Show') ELSE tags_array END
    WHERE restaurant_id = NEW.restaurant_id AND phone = NEW.customer_phone;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.track_no_show() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reservations_track_no_show ON public.reservations;
CREATE TRIGGER reservations_track_no_show AFTER UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.track_no_show();