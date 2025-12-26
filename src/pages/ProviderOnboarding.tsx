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
import { Home, Building, Shirt, Truck } from 'lucide-react';

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
  });

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Update profile with phone
      await supabase
        .from('profiles')
        .update({ phone: formData.phone })
        .eq('id', user.id);

      // Create provider profile
      const { error } = await supabase
        .from('providers')
        .insert({
          user_id: user.id,
          provider_type: formData.providerType,
          business_name: formData.businessName,
          description: formData.description,
          hourly_rate: parseFloat(formData.hourlyRate) || null,
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
            Step {step} of 2 - {step === 1 ? 'Choose your service type' : 'Business details'}
          </CardDescription>
          <div className="flex gap-2 justify-center mt-4">
            <div className={`h-2 w-20 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-20 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
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
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
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
