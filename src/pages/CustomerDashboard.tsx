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
  Truck, Hammer, LayoutGrid, Square, LogOut, User, Calendar
} from 'lucide-react';
import { toast } from 'sonner';

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

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [view, setView] = useState<'browse' | 'bookings'>('browse');

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
  }, [user]);

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

  const filteredProviders = providers.filter((provider) => {
    const matchesSearch = provider.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search for cleaners, moving companies..."
                  className="pl-12 h-14 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

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

            {/* Available Providers */}
            <section>
              <h2 className="text-2xl font-bold mb-6">Available Providers Near You</h2>
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
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">
                            KES {provider.hourly_rate || '---'}/hr
                          </span>
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
          <section>
            <h2 className="text-2xl font-bold mb-6">My Bookings</h2>
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
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status.replace('_', ' ')}
                      </Badge>
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
