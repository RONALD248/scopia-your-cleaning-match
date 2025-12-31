import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Phone, MessageCircle } from 'lucide-react';
import LiveTrackingMap from '@/components/LiveTrackingMap';

interface BookingDetails {
  id: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  location_lat: number | null;
  location_lng: number | null;
  provider_id: string;
  providers: {
    business_name: string;
    provider_type: string;
    user_id: string;
  };
  profiles?: {
    phone: string;
  };
}

const TrackProvider = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    if (user && bookingId) {
      fetchBooking();
    }
  }, [user, loading, bookingId, navigate]);

  const fetchBooking = async () => {
    if (!bookingId) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        providers (
          business_name,
          provider_type,
          user_id
        )
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      navigate('/customer');
      return;
    }

    const bookingData = data as unknown as BookingDetails;
    
    // Get provider's phone from profiles
    if (bookingData?.providers?.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', data.providers.user_id)
        .single();
      
      if (profileData) {
        bookingData.profiles = profileData;
      }
    }

    setBooking(bookingData);
    setIsLoading(false);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'accepted':
        return { label: 'Provider on the way', color: 'bg-blue-500/10 text-blue-600' };
      case 'in_progress':
        return { label: 'Job in progress', color: 'bg-primary/10 text-primary' };
      default:
        return { label: status, color: 'bg-muted text-muted-foreground' };
    }
  };

  const providerTypeLabels: Record<string, string> = {
    cleaner: 'Cleaner',
    cleaning_company: 'Cleaning Company',
    mama_fua: 'Mama Fua',
    moving_company: 'Moving Company',
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Booking not found</p>
      </div>
    );
  }

  const statusInfo = getStatusInfo(booking.status);
  const customerLocation = booking.location_lat && booking.location_lng
    ? { lat: booking.location_lat, lng: booking.location_lng }
    : { lat: -1.2921, lng: 36.8219 }; // Default to Nairobi

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customer')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Track Provider</h1>
            <p className="text-sm text-muted-foreground">{booking.providers.business_name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{booking.providers.business_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {providerTypeLabels[booking.providers.provider_type]}
                </p>
              </div>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Live Map */}
        {(booking.status === 'accepted' || booking.status === 'in_progress') && (
          <LiveTrackingMap
            bookingId={booking.id}
            customerLocation={customerLocation}
            providerName={booking.providers.business_name}
          />
        )}

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-5 h-5" />
              <span>{new Date(booking.scheduled_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span>{booking.scheduled_time}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="w-5 h-5" />
              <span>{booking.address}</span>
            </div>
          </CardContent>
        </Card>

        {/* Contact Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button 
                variant="default" 
                className="flex-1"
                onClick={() => navigate(`/chat/${booking.id}`)}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                In-App Chat
              </Button>
              {booking.profiles?.phone && (
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`tel:${booking.profiles.phone}`}>
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TrackProvider;
