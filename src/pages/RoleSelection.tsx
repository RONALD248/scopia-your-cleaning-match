import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Briefcase } from 'lucide-react';
import { useEffect } from 'react';

const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, userRole, setUserRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && userRole) {
      navigate(userRole === 'provider' ? '/provider' : '/customer');
    }
  }, [user, userRole, loading, navigate]);

  const handleRoleSelect = async (role: 'customer' | 'provider') => {
    await setUserRole(role);
    navigate(role === 'provider' ? '/provider/onboarding' : '/customer');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to <span className="text-primary">SCOPIA</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            How would you like to use the platform?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card 
            className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-primary/50 group"
            onClick={() => handleRoleSelect('customer')}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <User className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">I need services</CardTitle>
              <CardDescription className="text-base">
                Find cleaners, moving companies, and more near you
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li>✓ Browse nearby providers</li>
                <li>✓ Book services instantly</li>
                <li>✓ Track your bookings</li>
                <li>✓ Rate & review providers</li>
              </ul>
              <Button className="w-full" size="lg">
                Continue as Customer
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-secondary/50 group"
            onClick={() => handleRoleSelect('provider')}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-secondary/20 transition-colors">
                <Briefcase className="w-10 h-10 text-secondary" />
              </div>
              <CardTitle className="text-2xl">I offer services</CardTitle>
              <CardDescription className="text-base">
                Join as a cleaner, company, or service provider
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-muted-foreground space-y-2 mb-6">
                <li>✓ Reach more customers</li>
                <li>✓ Manage your bookings</li>
                <li>✓ Set your own rates</li>
                <li>✓ Build your reputation</li>
              </ul>
              <Button variant="secondary" className="w-full" size="lg">
                Continue as Provider
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
