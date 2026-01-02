import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, MapPin, Star, Clock, Home, Building, Sparkles, Shirt, 
  Truck, Hammer, LayoutGrid, Square, LogOut, User, Calendar, Map as MapIcon, 
  List, Navigation, MessageCircle, CheckCircle, AlertCircle, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import ProvidersMap from '@/components/ProvidersMap';
import NotificationSettings from '@/components/NotificationSettings';
import BookingCard from '@/components/BookingCard';

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Provider {
  id: string;
  business_name: string;
  description: string;
  hourly_rate: number;
  provider_type: string;
  rating: number;
  total_reviews: number;
  is_available: boolean;
  location_lat: number | null;
  location_lng: number | null;
}

interface Booking {
  id: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  duration_hours: number | null;
  total_amount: number | null;
  notes: string | null;
  provider_id: string;
  providers: {
    business_name: string;
    provider_type: string;
    hourly_rate: number | null;
  };
}

const iconMap: Record<string, any> = {
  home: Home,
  building: Building,
  sparkles: Sparkles,
  shirt: Shirt,
  truck: Truck,
  hammer: Hammer,
  'layout-grid': LayoutGrid,
  square: Square,
};

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [view, setView] = useState<'browse' | 'bookings'>('browse');
  const [displayMode, setDisplayMode] = useState<'map' | 'list'>('map');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchCategories();
    fetchProviders();
    if (user) {
      fetchBookings();
    }
    // Try to get user location on mount
    getCurrentLocation();
  }, [user]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Could not get location:', error);
          // Default to Nairobi
          setUserLocation({ lat: -1.2921, lng: 36.8219 });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      // Default to Nairobi
      setUserLocation({ lat: -1.2921, lng: 36.8219 });
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('service_categories')
      .select('*');
    if (data) setCategories(data);
  };

  const fetchProviders = async () => {
    const { data } = await supabase
      .from('providers')
      .select('*')
      .eq('is_available', true);
    if (data) setProviders(data);
  };

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        providers (
          business_name,
          provider_type,
          hourly_rate
        )
      `)
      .order('scheduled_date', { ascending: true });
    if (data) setBookings(data as unknown as Booking[]);
  };

  // Group bookings by status
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const activeBookings = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  // Sort providers by distance from user
  const sortedProviders = [...providers]
    .map(provider => {
      let distance = null;
      if (userLocation && provider.location_lat && provider.location_lng) {
        distance = calculateDistance(
          userLocation.lat, 
          userLocation.lng, 
          provider.location_lat, 
          provider.location_lng
        );
      }
      return { ...provider, distance };
    })
    .sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

  const filteredProviders = sortedProviders.filter((provider) => {
    const matchesSearch = provider.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleProviderSelect = (providerId: string) => {
    navigate(`/book/${providerId}`);
  };

  const handleUserLocationChange = (lat: number, lng: number) => {
    setUserLocation({ lat, lng });
  };

  const providerTypeLabels: Record<string, string> = {
    cleaner: 'Cleaner',
    cleaning_company: 'Cleaning Company',
    mama_fua: 'Mama Fua',
    moving_company: 'Moving Company',
  };

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
          <h1 className="text-2xl font-bold text-primary">SCOPIA</h1>
          <div className="flex items-center gap-4">
            <Button
              variant={view === 'browse' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('browse')}
            >
              <Search className="w-4 h-4 mr-2" />
              Browse
            </Button>
            <Button
              variant={view === 'bookings' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('bookings')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              My Bookings
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {view === 'browse' ? (
          <>
            {/* Search Bar with View Toggle */}
            <div className="mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-center max-w-4xl mx-auto">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search for cleaners, moving companies..."
                    className="pl-12 h-14 text-lg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 bg-muted rounded-lg p-1">
                  <Button
                    variant={displayMode === 'map' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDisplayMode('map')}
                  >
                    <MapIcon className="w-4 h-4 mr-2" />
                    Map
                  </Button>
                  <Button
                    variant={displayMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDisplayMode('list')}
                  >
                    <List className="w-4 h-4 mr-2" />
                    List
                  </Button>
                </div>
              </div>
              {userLocation && (
                <p className="text-center text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Showing providers near your location
                </p>
              )}
            </div>

            {/* Map View */}
            {displayMode === 'map' && (
              <section className="mb-8">
                <ProvidersMap
                  providers={filteredProviders}
                  onProviderSelect={handleProviderSelect}
                  userLocation={userLocation}
                  onUserLocationChange={handleUserLocationChange}
                />
              </section>
            )}

            {/* Service Categories */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Service Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map((category) => {
                  const IconComponent = iconMap[category.icon] || Home;
                  return (
                    <Card
                      key={category.id}
                      className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                        selectedCategory === category.id ? 'border-primary ring-2 ring-primary/20' : ''
                      }`}
                      onClick={() => setSelectedCategory(
                        selectedCategory === category.id ? null : category.id
                      )}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <IconComponent className="w-7 h-7 text-primary" />
                        </div>
                        <h3 className="font-semibold">{category.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Available Providers List */}
            <section>
              <h2 className="text-2xl font-bold mb-6">
                {displayMode === 'map' ? 'Nearby Providers' : 'Available Providers Near You'}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProviders.map((provider) => (
                  <Card key={provider.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{provider.business_name}</CardTitle>
                          <Badge variant="secondary" className="mt-1">
                            {providerTypeLabels[provider.provider_type]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                          <Star className="w-4 h-4 text-primary fill-primary" />
                          <span className="text-sm font-medium">{provider.rating || 'New'}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {provider.description || 'Professional service provider ready to help.'}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">
                              KES {provider.hourly_rate || '---'}/hr
                            </span>
                          </div>
                          {(provider as any).distance !== null && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span className="text-sm">
                                {(provider as any).distance.toFixed(1)} km away
                              </span>
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => navigate(`/book/${provider.id}`)}
                        >
                          Book Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredProviders.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No providers found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or check back later.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          /* Bookings View */
          <section className="space-y-6">
            {/* Notification Settings */}
            <NotificationSettings />

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingBookings.length}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeBookings.length}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedBookings.length}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{cancelledBookings.length}</p>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bookings Tabs */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start mb-4 h-auto flex-wrap">
                <TabsTrigger value="all" className="gap-2">
                  All
                  <Badge variant="secondary" className="ml-1">{bookings.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="w-3 h-3" />
                  Pending
                  {pendingBookings.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{pendingBookings.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-2">
                  <Navigation className="w-3 h-3" />
                  Active
                  {activeBookings.length > 0 && (
                    <Badge className="ml-1 bg-blue-500">{activeBookings.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  <CheckCircle className="w-3 h-3" />
                  Completed
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="gap-2">
                  <XCircle className="w-3 h-3" />
                  Cancelled
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {bookings.length === 0 ? (
                  <EmptyBookings onBrowse={() => setView('browse')} />
                ) : (
                  bookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking} 
                      onUpdate={fetchBookings} 
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="pending" className="space-y-4">
                {pendingBookings.length === 0 ? (
                  <EmptyState 
                    icon={<Clock className="w-12 h-12" />}
                    title="No pending bookings"
                    description="All your bookings have been responded to"
                  />
                ) : (
                  pendingBookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking} 
                      onUpdate={fetchBookings} 
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="active" className="space-y-4">
                {activeBookings.length === 0 ? (
                  <EmptyState 
                    icon={<Navigation className="w-12 h-12" />}
                    title="No active bookings"
                    description="You don't have any ongoing services"
                  />
                ) : (
                  activeBookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking} 
                      onUpdate={fetchBookings} 
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedBookings.length === 0 ? (
                  <EmptyState 
                    icon={<CheckCircle className="w-12 h-12" />}
                    title="No completed bookings"
                    description="Your completed bookings will appear here"
                  />
                ) : (
                  completedBookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking} 
                      onUpdate={fetchBookings} 
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="cancelled" className="space-y-4">
                {cancelledBookings.length === 0 ? (
                  <EmptyState 
                    icon={<XCircle className="w-12 h-12" />}
                    title="No cancelled bookings"
                    description="You haven't cancelled any bookings"
                  />
                ) : (
                  cancelledBookings.map((booking) => (
                    <BookingCard 
                      key={booking.id} 
                      booking={booking} 
                      onUpdate={fetchBookings} 
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </section>
        )}

        {/* Helper Components */}
        {null}
      </main>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) => (
  <div className="text-center py-12">
    <div className="text-muted-foreground mb-4 flex justify-center">{icon}</div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);

// Empty Bookings Component
const EmptyBookings = ({ onBrowse }: { onBrowse: () => void }) => (
  <div className="text-center py-12">
    <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
    <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
    <p className="text-muted-foreground mb-4">
      Find a service provider and make your first booking!
    </p>
    <Button onClick={onBrowse}>Browse Providers</Button>
  </div>
);

export default CustomerDashboard;
