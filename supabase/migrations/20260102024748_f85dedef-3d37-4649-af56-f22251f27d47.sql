-- Create payments table for M-Pesa transactions
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  phone_number TEXT NOT NULL,
  merchant_request_id TEXT,
  checkout_request_id TEXT,
  mpesa_receipt_number TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  result_code TEXT,
  result_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Customers can view their own payments
CREATE POLICY "Customers can view their own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = customer_id);

-- Providers can view payments for their bookings
CREATE POLICY "Providers can view payments for their bookings"
ON public.payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM providers
  WHERE providers.id = payments.provider_id
  AND providers.user_id = auth.uid()
));

-- Customers can create payments
CREATE POLICY "Customers can create payments"
ON public.payments
FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- Allow edge function to update payments (using service role)
CREATE POLICY "Service role can update payments"
ON public.payments
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();