-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('customer', 'provider', 'admin');

-- Create provider type enum
CREATE TYPE public.provider_type AS ENUM ('cleaner', 'cleaning_company', 'mama_fua', 'moving_company');

-- Create booking status enum
CREATE TYPE public.booking_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roles"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create providers table
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  provider_type provider_type NOT NULL,
  business_name TEXT NOT NULL,
  description TEXT,
  hourly_rate DECIMAL(10,2),
  is_available BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  service_radius_km INTEGER DEFAULT 10,
  rating DECIMAL(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  specializations TEXT[],
  certifications TEXT[],
  photos TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available providers"
ON public.providers FOR SELECT
USING (is_available = true OR auth.uid() = user_id);

CREATE POLICY "Providers can update their own profile"
ON public.providers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Providers can insert their own profile"
ON public.providers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create service_categories table
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  provider_types provider_type[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service categories"
ON public.service_categories FOR SELECT
USING (true);

-- Insert default service categories
INSERT INTO public.service_categories (name, description, icon, provider_types) VALUES
('Home Cleaning', 'Regular house cleaning and maintenance', 'home', ARRAY['cleaner', 'cleaning_company', 'mama_fua']::provider_type[]),
('Office Cleaning', 'Commercial office and workspace cleaning', 'building', ARRAY['cleaner', 'cleaning_company']::provider_type[]),
('Deep Cleaning', 'Thorough deep cleaning services', 'sparkles', ARRAY['cleaner', 'cleaning_company']::provider_type[]),
('Laundry Services', 'Washing, ironing, and fabric care', 'shirt', ARRAY['mama_fua']::provider_type[]),
('Moving Services', 'Packing and moving assistance', 'truck', ARRAY['moving_company']::provider_type[]),
('Post-Construction', 'Cleanup after construction or renovation', 'hammer', ARRAY['cleaning_company']::provider_type[]),
('Carpet Cleaning', 'Specialized carpet and upholstery cleaning', 'layout-grid', ARRAY['cleaner', 'cleaning_company']::provider_type[]),
('Window Cleaning', 'Interior and exterior window cleaning', 'square', ARRAY['cleaner', 'cleaning_company']::provider_type[]);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.service_categories(id),
  status booking_status DEFAULT 'pending' NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_hours INTEGER DEFAULT 2,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  address TEXT NOT NULL,
  notes TEXT,
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = customer_id);

CREATE POLICY "Providers can view their bookings"
ON public.bookings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.providers 
  WHERE providers.id = bookings.provider_id 
  AND providers.user_id = auth.uid()
));

CREATE POLICY "Customers can create bookings"
ON public.bookings FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their pending bookings"
ON public.bookings FOR UPDATE
USING (auth.uid() = customer_id AND status = 'pending');

CREATE POLICY "Providers can update their bookings"
ON public.bookings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.providers 
  WHERE providers.id = bookings.provider_id 
  AND providers.user_id = auth.uid()
));

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
ON public.reviews FOR SELECT
USING (true);

CREATE POLICY "Customers can create reviews for their completed bookings"
ON public.reviews FOR INSERT
WITH CHECK (
  auth.uid() = customer_id AND
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE bookings.id = booking_id 
    AND bookings.customer_id = auth.uid()
    AND bookings.status = 'completed'
  )
);

-- Function to update provider rating when review is added
CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.providers
  SET 
    rating = (SELECT AVG(rating)::DECIMAL(2,1) FROM public.reviews WHERE provider_id = NEW.provider_id),
    total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE provider_id = NEW.provider_id)
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_review_created
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_providers_updated_at
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();