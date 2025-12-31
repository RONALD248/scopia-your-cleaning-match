import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, MapPin, Star, Clock, Home, Building, Sparkles, Shirt, 
  Truck, Hammer, LayoutGrid, Square, LogOut, User, Calendar, Map as MapIcon, List, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import ProvidersMap from '@/components/ProvidersMap';
import NotificationSettings from '@/components/NotificationSettings';

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
  providers: {
    business_name: string;
    provider_type: string;
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
          provider_type
        )
      `)
      .order('created_at', { ascending: false });
    if (data) setBookings(data as unknown as Booking[]);
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600';
      case 'accepted': return 'bg-blue-500/10 text-blue-600';
      case 'in_progress': return 'bg-primary/10 text-primary';
      case 'completed': return 'bg-green-500/10 text-green-600';
      case 'cancelled': return 'bg-red-500/10 text-red-600';
      default: return 'bg-muted text-muted-foreground';
    }
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

            <h2 className="text-2xl font-bold">My Bookings</h2>
            <div className="space-y-4">
              {bookings.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{booking.providers?.business_name}</h3>
                        <p className="text-muted-foreground text-sm">
                          {providerTypeLabels[booking.providers?.provider_type]}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(booking.scheduled_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {booking.scheduled_time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {booking.address}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {(booking.status === 'accepted' || booking.status === 'in_progress') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/track/${booking.id}`)}
                            className="border-primary text-primary hover:bg-primary/10"
                          >
                            <Navigation className="w-4 h-4 mr-2" />
                            Track
                          </Button>
                        )}
                        <Badge className={getStatusColor(booking.status)}>
                          {booking.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {bookings.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Find a service provider and make your first booking!
                  </p>
                  <Button onClick={() => setView('browse')}>Browse Providers</Button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CustomerDashboard;
