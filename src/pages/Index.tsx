import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Search, Shield, Clock, Star } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <img src="/icon-192.png" alt="SCOPIA logo" className="w-9 h-9 rounded-lg" />
            <span className="text-2xl font-bold tracking-wide">SCOPIA</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button onClick={handleSignOut} variant="outline">
                  Sign Out
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/auth")}>Get Started</Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-24 px-4">
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Connect with Professional Cleaning Services
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90">
              SCOPIA matches you with verified cleaning providers based on location, availability, and expertise
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                Find a Cleaner
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 bg-white/10 hover:bg-white/20 text-white border-white/30"
                onClick={() => navigate("/auth")}
              >
                Become a Provider
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utb3BhY2l0eT0iMC4xIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container">
          <h2 className="text-4xl font-bold text-center mb-16">How SCOPIA Works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Search</h3>
              <p className="text-muted-foreground">
                Find cleaning services by category, location, and availability
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Match</h3>
              <p className="text-muted-foreground">
                GIS-powered matching connects you with nearest verified providers
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Book</h3>
              <p className="text-muted-foreground">
                Schedule instantly or book for later with flexible timing
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Track</h3>
              <p className="text-muted-foreground">
                Real-time tracking and secure payment with ratings
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container">
          <h2 className="text-4xl font-bold text-center mb-16">Service Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {["Domestic Cleaning", "Commercial Cleaning", "Industrial Cleaning", "Specialized Services"].map(
              (category) => (
                <div key={category} className="bg-card rounded-lg p-6 shadow-card hover:shadow-glow transition-shadow">
                  <h3 className="text-xl font-semibold mb-2">{category}</h3>
                  <p className="text-muted-foreground mb-4">
                    Professional {category.toLowerCase()} services near you
                  </p>
                  <div className="flex items-center text-sm text-primary">
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    <span>Verified Providers</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join SCOPIA today and experience hassle-free cleaning services
            </p>
            <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate("/auth")}>
              Sign Up Now
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-primary">
              <img src="/icon-192.png" alt="SCOPIA logo" className="w-7 h-7 rounded-md" />
              <span className="text-xl font-bold tracking-wide">SCOPIA</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 SCOPIA. Connecting customers with cleaning services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
