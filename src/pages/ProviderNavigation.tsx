import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useProviderTracking } from '@/hooks/useProviderTracking';
import TurnByTurnNavigation from '@/components/TurnByTurnNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Navigation, Phone, MessageCircle, MapPin, Clock, User } from 'lucide-react';
import { toast } from 'sonner';

interface BookingDetails {
  id: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  location_lat: number | null;
  location_lng: number | null;
  customer_id: string;
  provider_id: string;
  profiles?: {
    full_name: string;
    phone: string;
  };
}

const ProviderNavigation = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [provider, setProvider] = useState<{ id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { isTracking, currentLocation, startTracking, stopTracking } = useProviderTracking(
    provider?.id || null,
    bookingId || null
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    if (user && bookingId) {
      fetchData();
    }
  }, [user, loading, bookingId, navigate]);

  const fetchData = async () => {
    if (!user || !bookingId) return;

    // Get provider
    const { data: providerData } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!providerData) {
      toast.error('Provider profile not found');
      navigate('/provider');
      return;
    }

    setProvider(providerData);

    // Get booking with customer info
    const { data: bookingData, error } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles:customer_id (
          full_name,
          phone
        )
      `)
      .eq('id', bookingId)
      .eq('provider_id', providerData.id)
      .single();

    if (error || !bookingData) {
      toast.error('Booking not found');
      navigate('/provider');
      return;
    }

    setBooking(bookingData as unknown as BookingDetails);
    setIsLoading(false);
  };

  const handleStartNavigation = async () => {
    await startTracking();
  };

  const handleStopNavigation = async () => {
    await stopTracking();
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

  const customerLocation = booking.location_lat && booking.location_lng
    ? { lat: booking.location_lat, lng: booking.location_lng }
    : { lat: -1.2921, lng: 36.8219 }; // Default to Nairobi

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/provider')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              Navigation
            </h1>
            <p className="text-sm text-muted-foreground">
              Navigate to {booking.profiles?.full_name || 'Customer'}
            </p>
          </div>
          {isTracking ? (
            <Badge className="bg-green-500/10 text-green-600 border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              Live
            </Badge>
          ) : (
            <Badge variant="secondary">Offline</Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Customer Info Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{booking.profiles?.full_name || 'Customer'}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{booking.scheduled_time}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => navigate(`/chat/${booking.id}`)}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                {booking.profiles?.phone && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={`tel:${booking.profiles.phone}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{booking.address}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start/Stop Navigation Button */}
        {!isTracking ? (
          <Button 
            className="w-full h-14 text-lg"
            onClick={handleStartNavigation}
          >
            <Navigation className="w-5 h-5 mr-2" />
            Start Navigation
          </Button>
        ) : (
          <Button 
            variant="destructive"
            className="w-full h-14 text-lg"
            onClick={handleStopNavigation}
          >
            Stop Navigation
          </Button>
        )}

        {/* Turn-by-Turn Navigation Component */}
        <TurnByTurnNavigation
          providerLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null}
          customerLocation={customerLocation}
        />
      </main>
    </div>
  );
};

export default ProviderNavigation;
