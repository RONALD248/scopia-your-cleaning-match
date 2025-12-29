-- Fix search_path for the location timestamp function
CREATE OR REPLACE FUNCTION public.update_provider_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;