import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, Clock, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import LocationPicker from '@/components/LocationPicker';

interface Provider {
  id: string;
  business_name: string;
  description: string;
  hourly_rate: number;
  provider_type: string;
  rating: number;
  total_reviews: number;
  total_jobs: number;
  location_lat: number | null;
  location_lng: number | null;
}

const providerTypeLabels: Record<string, string> = {
  cleaner: 'Cleaner',
  cleaning_company: 'Cleaning Company',
  mama_fua: 'Mama Fua',
  moving_company: 'Moving Company',
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

const BookProvider = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: '2',
    address: '',
    notes: '',
    locationLat: null as number | null,
    locationLng: null as number | null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (providerId) {
      fetchProvider();
    }
  }, [providerId, user, authLoading, navigate]);

  const fetchProvider = async () => {
    const { data } = await supabase
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .maybeSingle();
    
    if (data) {
      setProvider(data);
    } else {
      toast.error('Provider not found');
      navigate('/customer');
    }
  };

  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setFormData({ 
      ...formData, 
      locationLat: lat, 
      locationLng: lng,
      address: address || formData.address
    });
  };

  const calculateTotal = () => {
    if (!provider?.hourly_rate) return 0;
    return provider.hourly_rate * parseInt(formData.duration);
  };

  const getDistanceToProvider = () => {
    if (!provider?.location_lat || !provider?.location_lng || !formData.locationLat || !formData.locationLng) {
      return null;
    }
    return calculateDistance(
      formData.locationLat,
      formData.locationLng,
      provider.location_lat,
      provider.location_lng
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !provider) return;

    if (!formData.locationLat || !formData.locationLng) {
      toast.error('Please set your location on the map');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          provider_id: provider.id,
          scheduled_date: formData.date,
          scheduled_time: formData.time,
          duration_hours: parseInt(formData.duration),
          address: formData.address,
          notes: formData.notes,
          total_amount: calculateTotal(),
          location_lat: formData.locationLat,
          location_lng: formData.locationLng,
        });

      if (error) throw error;

      toast.success('Booking request sent!');
      navigate('/customer');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const distance = getDistanceToProvider();

  if (authLoading || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customer')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Book Service</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Provider Info */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">{provider.business_name}</h2>
                <Badge variant="secondary" className="mt-1">
                  {providerTypeLabels[provider.provider_type]}
                </Badge>
                <p className="text-muted-foreground mt-3">{provider.description}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 bg-primary/10 px-3 py-1 rounded-full">
                  <Star className="w-5 h-5 text-primary fill-primary" />
                  <span className="font-semibold">{provider.rating || 'New'}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {provider.total_reviews} reviews
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">KES {provider.hourly_rate}/hr</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{provider.total_jobs} jobs completed</Badge>
              </div>
              {distance !== null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-5 h-5" />
                  <span>{distance.toFixed(1)} km from you</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Your Service</CardTitle>
            <CardDescription>Fill in the details for your booking</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>

              {/* Location Picker */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Service Location
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Click on the map or use your current location to set where the service should be provided.
                </p>
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialLat={formData.locationLat || undefined}
                  initialLng={formData.locationLng || undefined}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Service Address</Label>
                <Input
                  id="address"
                  placeholder="Enter your full address"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  This will be auto-filled when you select a location on the map
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions or requirements..."
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Price Summary */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">
                    KES {provider.hourly_rate} × {formData.duration} hours
                  </span>
                  <span className="font-medium">KES {calculateTotal().toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">KES {calculateTotal().toLocaleString()}</span>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BookProvider;
