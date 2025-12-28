-- Create table for real-time provider locations during active jobs
CREATE TABLE public.provider_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider_id, booking_id)
);

-- Enable RLS
ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;

-- Providers can update their own location
CREATE POLICY "Providers can manage their own location"
ON public.provider_locations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.providers 
    WHERE providers.id = provider_locations.provider_id 
    AND providers.user_id = auth.uid()
  )
);

-- Customers can view location for their bookings
CREATE POLICY "Customers can view provider location for their bookings"
ON public.provider_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE bookings.id = provider_locations.booking_id 
    AND bookings.customer_id = auth.uid()
  )
);

-- Enable realtime for provider_locations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_locations;

-- Create function to auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_provider_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
CREATE TRIGGER update_provider_locations_timestamp
BEFORE UPDATE ON public.provider_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_location_timestamp();