import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ChatWindow from '@/components/ChatWindow';

interface BookingInfo {
  id: string;
  customer_id: string;
  providers: {
    business_name: string;
    user_id: string;
  };
  profiles?: {
    full_name: string;
  };
}

const Chat = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [otherPartyName, setOtherPartyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    if (user && bookingId) {
      fetchBookingInfo();
    }
  }, [user, loading, bookingId, navigate]);

  const fetchBookingInfo = async () => {
    if (!bookingId || !user) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        providers (
          business_name,
          user_id
        )
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      navigate(-1);
      return;
    }

    const bookingData = data as unknown as BookingInfo;
    setBooking(bookingData);

    // Determine the other party's name
    const isCustomer = bookingData.customer_id === user.id;
    
    if (isCustomer) {
      // Customer is viewing, show provider name
      setOtherPartyName(bookingData.providers?.business_name || 'Provider');
    } else {
      // Provider is viewing, get customer name
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', bookingData.customer_id)
        .single();
      
      setOtherPartyName(customerProfile?.full_name || 'Customer');
    }

    setIsLoading(false);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking || !bookingId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Chat not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-primary">SCOPIA</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <ChatWindow
          bookingId={bookingId}
          otherPartyName={otherPartyName}
          onBack={() => navigate(-1)}
        />
      </main>
    </div>
  );
};

export default Chat;
