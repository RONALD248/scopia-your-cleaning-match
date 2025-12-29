import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigation, Clock, MapPin } from 'lucide-react';

interface LiveTrackingMapProps {
  bookingId: string;
  customerLocation: { lat: number; lng: number };
  providerName: string;
}

interface ProviderLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

// Calculate distance using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Estimate arrival time based on distance and speed
const estimateArrival = (distance: number, speed: number | null): string => {
  const avgSpeed = speed && speed > 0 ? speed * 3.6 : 30; // Convert m/s to km/h, default 30 km/h
  const timeHours = distance / avgSpeed;
  const timeMinutes = Math.round(timeHours * 60);
  
  if (timeMinutes < 1) return 'Arriving now';
  if (timeMinutes === 1) return '1 min away';
  return `${timeMinutes} mins away`;
};

const LiveTrackingMap = ({ bookingId, customerLocation, providerName }: LiveTrackingMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const providerMarker = useRef<mapboxgl.Marker | null>(null);
  const customerMarker = useRef<mapboxgl.Marker | null>(null);
  const [providerLocation, setProviderLocation] = useState<ProviderLocation | null>(null);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      const { data } = await supabase.functions.invoke('get-mapbox-token');
      if (data?.token) {
        setMapToken(data.token);
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [customerLocation.lng, customerLocation.lat],
      zoom: 14,
    });

    // Add customer marker (destination)
    const customerEl = document.createElement('div');
    customerEl.className = 'customer-marker';
    customerEl.innerHTML = `
      <div style="
        width: 40px; 
        height: 40px; 
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `;
    
    customerMarker.current = new mapboxgl.Marker(customerEl)
      .setLngLat([customerLocation.lng, customerLocation.lat])
      .addTo(map.current);

    return () => {
      map.current?.remove();
    };
  }, [mapToken, customerLocation]);

  // Subscribe to real-time location updates
  useEffect(() => {
    const channel = supabase
      .channel(`tracking-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_locations',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setProviderLocation(null);
          } else {
            const newLocation = payload.new as ProviderLocation;
            setProviderLocation(newLocation);
          }
        }
      )
      .subscribe();

    // Fetch initial location
    const fetchInitialLocation = async () => {
      const { data } = await supabase
        .from('provider_locations')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();
      
      if (data) {
        setProviderLocation(data);
      }
    };
    
    fetchInitialLocation();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Update provider marker on location change
  useEffect(() => {
    if (!map.current || !providerLocation) return;

    const { latitude, longitude, heading } = providerLocation;

    // Calculate distance
    const dist = calculateDistance(
      customerLocation.lat,
      customerLocation.lng,
      latitude,
      longitude
    );
    setDistance(dist);

    // Create or update provider marker
    if (providerMarker.current) {
      providerMarker.current.setLngLat([longitude, latitude]);
      
      // Rotate marker based on heading
      if (heading !== null) {
        const el = providerMarker.current.getElement();
        el.style.transform = `rotate(${heading}deg)`;
      }
    } else {
      const providerEl = document.createElement('div');
      providerEl.className = 'provider-marker';
      providerEl.innerHTML = `
        <div style="
          width: 50px; 
          height: 50px; 
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
          border-radius: 50%; 
          border: 3px solid white; 
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style="transform: rotate(-45deg);">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      `;

      providerMarker.current = new mapboxgl.Marker(providerEl)
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    }

    // Fit bounds to show both markers
    const bounds = new mapboxgl.LngLatBounds()
      .extend([customerLocation.lng, customerLocation.lat])
      .extend([longitude, latitude]);
    
    map.current.fitBounds(bounds, {
      padding: 80,
      maxZoom: 15,
    });
  }, [providerLocation, customerLocation]);

  if (!mapToken) {
    return (
      <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Status Bar */}
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Navigation className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{providerName}</h3>
                {providerLocation ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Live tracking active
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for provider...</p>
                )}
              </div>
            </div>
            {distance !== null && providerLocation && (
              <div className="text-right">
                <Badge variant="secondary" className="mb-1">
                  <Clock className="w-3 h-3 mr-1" />
                  {estimateArrival(distance, providerLocation.speed)}
                </Badge>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <MapPin className="w-3 h-3" />
                  {distance.toFixed(1)} km away
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div ref={mapContainer} className="h-72 w-full" />

        {/* Legend */}
        <div className="p-3 bg-muted/50 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full"></div>
            <span className="text-muted-foreground">Provider</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-green-700 rounded-full"></div>
            <span className="text-muted-foreground">Your Location</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveTrackingMap;
