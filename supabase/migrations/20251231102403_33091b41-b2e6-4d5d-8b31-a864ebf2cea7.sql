-- Create table for chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages for their bookings
CREATE POLICY "Users can view chat messages for their bookings"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = chat_messages.booking_id
    AND (
      b.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.providers p
        WHERE p.id = b.provider_id AND p.user_id = auth.uid()
      )
    )
  )
);

-- Policy: Users can send messages for their bookings
CREATE POLICY "Users can send chat messages for their bookings"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = chat_messages.booking_id
    AND (
      b.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.providers p
        WHERE p.id = b.provider_id AND p.user_id = auth.uid()
      )
    )
  )
);

-- Policy: Users can mark messages as read
CREATE POLICY "Users can update read status"
ON public.chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = chat_messages.booking_id
    AND (
      b.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.providers p
        WHERE p.id = b.provider_id AND p.user_id = auth.uid()
      )
    )
  )
);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Create index for faster queries
CREATE INDEX idx_chat_messages_booking_id ON public.chat_messages(booking_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);