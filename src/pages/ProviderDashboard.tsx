import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useProviderTracking } from '@/hooks/useProviderTracking';
import { sendPushNotification } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Calendar, Clock, MapPin, Star, DollarSign, 
  Users, CheckCircle, XCircle, LogOut, Settings, Navigation, MapPinOff, MessageCircle, Compass
} from 'lucide-react';
import { toast } from 'sonner';

interface Provider {
  id: string;
  business_name: string;
  provider_type: string;
  hourly_rate: number;
  is_available: boolean;
  rating: number;
  total_reviews: number;
  total_jobs: number;
}

interface Booking {
  id: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  duration_hours: number;
  total_amount: number;
  notes: string;
  customer_id: string;
  profiles?: {
    full_name: string;
    phone: string;
  };
}

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [view, setView] = useState<'jobs' | 'earnings'>('jobs');
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(null);
  
  const { isTracking, startTracking, stopTracking } = useProviderTracking(
    provider?.id || null,
    trackingBookingId
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      fetchProviderProfile();
      fetchBookings();
    }
  }, [user, loading, navigate]);

  const fetchProviderProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setProvider(data);
      setIsAvailable(data.is_available);
    } else {
      // No provider profile, redirect to onboarding
      navigate('/provider/onboarding');
    }
  };

  const fetchBookings = async () => {
    if (!user) return;
    
    const { data: providerData } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!providerData) return;

    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles:customer_id (
          full_name,
          phone
        )
      `)
      .eq('provider_id', providerData.id)
      .order('created_at', { ascending: false });
    
    if (data) setBookings(data as unknown as Booking[]);
  };

  const toggleAvailability = async () => {
    if (!provider) return;
    
    const newStatus = !isAvailable;
    const { error } = await supabase
      .from('providers')
      .update({ is_available: newStatus })
      .eq('id', provider.id);
    
    if (!error) {
      setIsAvailable(newStatus);
      toast.success(newStatus ? 'You are now online!' : 'You are now offline');
    }
  };

  const updateBookingStatus = async (bookingId: string, status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled') => {
    // Find the booking to get customer_id for notification
    const booking = bookings.find(b => b.id === bookingId);
    
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);
    
    if (!error) {
      toast.success(`Booking ${status}`);
      fetchBookings();
      
      // Send push notification to customer
      if (booking && provider) {
        if (status === 'accepted') {
          sendPushNotification(
            booking.customer_id,
            'Booking Accepted! 🎉',
            `${provider.business_name} has accepted your booking for ${new Date(booking.scheduled_date).toLocaleDateString()}`,
            { url: `/track/${bookingId}` }
          );
        } else if (status === 'in_progress') {
          sendPushNotification(
            booking.customer_id,
            'Service Started',
            `${provider.business_name} has started working on your booking`,
            { url: `/track/${bookingId}` }
          );
        } else if (status === 'completed') {
          sendPushNotification(
            booking.customer_id,
            'Job Completed ✅',
            `${provider.business_name} has completed your service. Please leave a review!`,
            { url: '/customer' }
          );
        }
      }
      
      // Update total jobs if completed
      if (status === 'completed' && provider) {
        await supabase
          .from('providers')
          .update({ total_jobs: (provider.total_jobs || 0) + 1 })
          .eq('id', provider.id);
        
        // Stop tracking when job is completed
        if (isTracking && trackingBookingId === bookingId) {
          await stopTracking();
          setTrackingBookingId(null);
        }
      }
      
      // Stop tracking if job is cancelled
      if (status === 'cancelled' && isTracking && trackingBookingId === bookingId) {
        await stopTracking();
        setTrackingBookingId(null);
      }
    }
  };

  const handleStartTracking = async (bookingId: string) => {
    setTrackingBookingId(bookingId);
    // Small delay to allow state update
    setTimeout(() => startTracking(), 100);
  };

  const handleStopTracking = async () => {
    await stopTracking();
    setTrackingBookingId(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'accepted': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20';
      case 'completed': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const activeBookings = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  
  const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">SCOPIA</h1>
            <p className="text-sm text-muted-foreground">Provider Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isAvailable ? 'text-green-600' : 'text-muted-foreground'}`}>
                {isAvailable ? 'Online' : 'Offline'}
              </span>
              <Switch
                checked={isAvailable}
                onCheckedChange={toggleAvailability}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{provider?.rating || '0.0'}</p>
                  <p className="text-sm text-muted-foreground">Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{provider?.total_jobs || 0}</p>
                  <p className="text-sm text-muted-foreground">Jobs Done</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">KES {totalEarnings.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingBookings.length}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Jobs */}
        {pendingBookings.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
              New Job Requests
            </h2>
            <div className="space-y-4">
              {pendingBookings.map((booking) => (
                <Card key={booking.id} className="border-yellow-200 bg-yellow-50/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{booking.profiles?.full_name || 'Customer'}</h3>
                          <Badge className={getStatusColor(booking.status)}>New</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(booking.scheduled_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {booking.scheduled_time} ({booking.duration_hours}hrs)
                          </span>
                          <span className="flex items-center gap-1 col-span-2">
                            <MapPin className="w-4 h-4" />
                            {booking.address}
                          </span>
                        </div>
                        {booking.notes && (
                          <p className="mt-2 text-sm bg-background p-2 rounded">
                            <strong>Notes:</strong> {booking.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateBookingStatus(booking.id, 'accepted')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Active Jobs */}
        {activeBookings.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Active Jobs</h2>
            <div className="space-y-4">
              {activeBookings.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{booking.profiles?.full_name || 'Customer'}</h3>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(booking.scheduled_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {booking.scheduled_time}
                          </span>
                          <span className="flex items-center gap-1 col-span-2">
                            <MapPin className="w-4 h-4" />
                            {booking.address}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          variant="outline"
                          onClick={() => navigate(`/chat/${booking.id}`)}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Chat
                        </Button>
                        <Button 
                          variant="outline"
                          className="border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={() => navigate(`/navigate/${booking.id}`)}
                        >
                          <Compass className="w-4 h-4 mr-2" />
                          Navigate
                        </Button>
                        {booking.status === 'accepted' && (
                          <>
                            {isTracking && trackingBookingId === booking.id ? (
                              <Button 
                                variant="outline" 
                                className="border-orange-200 text-orange-600 hover:bg-orange-50"
                                onClick={handleStopTracking}
                              >
                                <MapPinOff className="w-4 h-4 mr-2" />
                                Stop Sharing Location
                              </Button>
                            ) : (
                              <Button 
                                variant="outline"
                                onClick={() => handleStartTracking(booking.id)}
                              >
                                <Navigation className="w-4 h-4 mr-2" />
                                Share Location
                              </Button>
                            )}
                            <Button onClick={() => updateBookingStatus(booking.id, 'in_progress')}>
                              Start Job
                            </Button>
                          </>
                        )}
                        {booking.status === 'in_progress' && (
                          <>
                            {isTracking && trackingBookingId === booking.id ? (
                              <Button 
                                variant="outline" 
                                className="border-orange-200 text-orange-600 hover:bg-orange-50"
                                onClick={handleStopTracking}
                              >
                                <MapPinOff className="w-4 h-4 mr-2" />
                                Stop Sharing
                              </Button>
                            ) : (
                              <Button 
                                variant="outline"
                                onClick={() => handleStartTracking(booking.id)}
                              >
                                <Navigation className="w-4 h-4 mr-2" />
                                Share Location
                              </Button>
                            )}
                            <Button 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => updateBookingStatus(booking.id, 'completed')}
                            >
                              Complete Job
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Recent Completed Jobs */}
        <section>
          <h2 className="text-xl font-bold mb-4">Recent Jobs</h2>
          <div className="space-y-4">
            {completedBookings.slice(0, 5).map((booking) => (
              <Card key={booking.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{booking.profiles?.full_name || 'Customer'}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(booking.scheduled_date).toLocaleDateString()} • {booking.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(booking.status)}>Completed</Badge>
                      {booking.total_amount && (
                        <p className="text-sm font-medium text-green-600 mt-1">
                          KES {booking.total_amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {completedBookings.length === 0 && pendingBookings.length === 0 && activeBookings.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No jobs yet</h3>
                <p className="text-muted-foreground">
                  Stay online to receive job requests from customers nearby.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProviderDashboard;
