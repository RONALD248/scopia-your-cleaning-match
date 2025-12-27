import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Home, Building, Shirt, Truck, MapPin } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';

type ProviderType = 'cleaner' | 'cleaning_company' | 'mama_fua' | 'moving_company';

const providerTypes = [
  { value: 'cleaner' as ProviderType, label: 'Individual Cleaner', icon: Home, description: 'Freelance cleaning professional' },
  { value: 'cleaning_company' as ProviderType, label: 'Cleaning Company', icon: Building, description: 'Registered cleaning business' },
  { value: 'mama_fua' as ProviderType, label: 'Mama Fua', icon: Shirt, description: 'Laundry & fabric care specialist' },
  { value: 'moving_company' as ProviderType, label: 'Moving Company', icon: Truck, description: 'Packing & moving services' },
];

const ProviderOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    providerType: '' as ProviderType,
    businessName: '',
    description: '',
    hourlyRate: '',
    phone: '',
    serviceRadius: '10',
    locationLat: null as number | null,
    locationLng: null as number | null,
    address: '',
  });

  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setFormData({ 
      ...formData, 
      locationLat: lat, 
      locationLng: lng,
      address: address || formData.address
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    if (!formData.locationLat || !formData.locationLng) {
      toast.error('Please set your service location on the map');
      return;
    }

    setLoading(true);
    try {
      // Update profile with phone and location
      await supabase
        .from('profiles')
        .update({ 
          phone: formData.phone,
          location_lat: formData.locationLat,
          location_lng: formData.locationLng,
          address: formData.address,
        })
        .eq('id', user.id);

      // Create provider profile with location
      const { error } = await supabase
        .from('providers')
        .insert({
          user_id: user.id,
          provider_type: formData.providerType,
          business_name: formData.businessName,
          description: formData.description,
          hourly_rate: parseFloat(formData.hourlyRate) || null,
          location_lat: formData.locationLat,
          location_lng: formData.locationLng,
          service_radius_km: parseInt(formData.serviceRadius) || 10,
        });

      if (error) throw error;

      toast.success('Profile created successfully!');
      navigate('/provider');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Complete Your Provider Profile</CardTitle>
          <CardDescription>
            Step {step} of 3 - {step === 1 ? 'Choose your service type' : step === 2 ? 'Set your location' : 'Business details'}
          </CardDescription>
          <div className="flex gap-2 justify-center mt-4">
            <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>

        <CardContent>
          {step === 1 && (
            <div className="space-y-6">
              <RadioGroup
                value={formData.providerType}
                onValueChange={(value) => setFormData({ ...formData, providerType: value as ProviderType })}
                className="grid md:grid-cols-2 gap-4"
              >
                {providerTypes.map((type) => (
                  <Label
                    key={type.value}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.providerType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value={type.value} className="sr-only" />
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <type.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              <Button
                className="w-full"
                size="lg"
                disabled={!formData.providerType}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Set Your Service Location</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Click on the map or use "Use My Location" to set where you'll provide services. Customers nearby will see you first.
                </p>
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialLat={formData.locationLat || undefined}
                  initialLng={formData.locationLng || undefined}
                />
                {formData.address && (
                  <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {formData.address}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceRadius">Service Radius (km)</Label>
                <Input
                  id="serviceRadius"
                  type="number"
                  placeholder="10"
                  value={formData.serviceRadius}
                  onChange={(e) => setFormData({ ...formData, serviceRadius: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  How far are you willing to travel to serve customers?
                </p>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!formData.locationLat || !formData.locationLng}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="Your business or professional name"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate (KES)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  placeholder="500"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">About Your Services</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your services, experience, and what makes you stand out..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!formData.businessName || loading}
                  onClick={handleSubmit}
                >
                  {loading ? 'Creating...' : 'Complete Setup'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProviderOnboarding;
