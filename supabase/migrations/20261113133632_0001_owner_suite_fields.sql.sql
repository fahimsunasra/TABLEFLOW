ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS seating_preference text;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.tables(id) ON DELETE SET NULL;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();
CREATE OR REPLACE FUNCTION public.touch_table_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_changed_at := now(); END IF; RETURN NEW; END $$;
CREATE TRIGGER tables_status_touch BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.touch_table_status();