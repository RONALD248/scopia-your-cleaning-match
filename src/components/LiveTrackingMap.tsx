import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Navigation, Clock, MapPin, RefreshCw, Navigation2, Loader2 } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';

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

// Smooth interpolation for marker movement
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

const LiveTrackingMap = ({ bookingId, customerLocation, providerName }: LiveTrackingMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const providerMarker = useRef<mapboxgl.Marker | null>(null);
  const customerMarker = useRef<mapboxgl.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const [providerLocation, setProviderLocation] = useState<ProviderLocation | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { token: mapToken, loading: tokenLoading } = useMapboxToken();

  // Animate marker to new position smoothly
  const animateMarker = useCallback((marker: mapboxgl.Marker, targetLng: number, targetLat: number, duration = 1000) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const currentPos = marker.getLngLat();
    const startLng = currentPos.lng;
    const startLat = currentPos.lat;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const newLng = lerp(startLng, targetLng, easeProgress);
      const newLat = lerp(startLat, targetLat, easeProgress);
      
      marker.setLngLat([newLng, newLat]);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
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
      pitch: 45, // Add 3D tilt
      bearing: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    // Add customer marker (destination) with pulse effect
    const customerEl = document.createElement('div');
    customerEl.className = 'customer-marker';
    customerEl.innerHTML = `
      <div class="pulse-ring"></div>
      <div style="
        width: 44px; 
        height: 44px; 
        background: linear-gradient(135deg, hsl(142, 76%, 36%) 0%, hsl(142, 76%, 26%) 100%); 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 2;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <style>
        .pulse-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(34, 197, 94, 0.3);
          animation: pulse 2s ease-out infinite;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
      </style>
    `;
    
    customerMarker.current = new mapboxgl.Marker({ element: customerEl, anchor: 'center' })
      .setLngLat([customerLocation.lng, customerLocation.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Your Location</strong><p>Service destination</p>'))
      .addTo(map.current);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
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
            setLastUpdate(new Date());
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
        setLastUpdate(new Date());
      }
    };
    
    fetchInitialLocation();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Update provider marker on location change with route
  useEffect(() => {
    if (!map.current || !providerLocation) return;

    const { latitude, longitude, heading, speed } = providerLocation;

    // Calculate distance
    const dist = calculateDistance(
      customerLocation.lat,
      customerLocation.lng,
      latitude,
      longitude
    );
    setDistance(dist);

    // Draw route between provider and customer
    const drawRoute = async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${longitude},${latitude};${customerLocation.lng},${customerLocation.lat}?geometries=geojson&access_token=${mapToken}`
        );
        const data = await response.json();
        
        if (data.routes?.[0]?.geometry) {
          const route = data.routes[0].geometry;
          
          if (map.current?.getSource('route')) {
            (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: route,
            });
          } else if (map.current?.isStyleLoaded()) {
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route,
              },
            });
            
            map.current.addLayer({
              id: 'route-outline',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#1d4ed8',
                'line-width': 8,
                'line-opacity': 0.3,
              },
            });
            
            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#3b82f6',
                'line-width': 4,
                'line-dasharray': [0, 2, 1],
              },
            });
          }
        }
      } catch (error) {
        console.log('Route drawing unavailable');
      }
    };

    drawRoute();

    // Create or update provider marker
    if (providerMarker.current) {
      // Smooth animation to new position
      animateMarker(providerMarker.current, longitude, latitude);
      
      // Rotate marker based on heading
      if (heading !== null) {
        const el = providerMarker.current.getElement();
        const innerDiv = el.querySelector('.provider-icon') as HTMLElement;
        if (innerDiv) {
          innerDiv.style.transform = `rotate(${heading}deg)`;
        }
      }
    } else {
      const providerEl = document.createElement('div');
      providerEl.className = 'provider-marker-container';
      providerEl.innerHTML = `
        <div class="provider-icon" style="
          width: 52px; 
          height: 52px; 
          background: linear-gradient(135deg, hsl(217, 91%, 60%) 0%, hsl(217, 91%, 40%) 100%); 
          border-radius: 50%; 
          border: 4px solid white; 
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.5s ease;
        ">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: hsl(217, 91%, 50%);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        ">${speed ? Math.round(speed * 3.6) + ' km/h' : 'Moving'}</div>
      `;

      providerMarker.current = new mapboxgl.Marker({ element: providerEl, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .setPopup(new mapboxgl.Popup({ offset: 30 }).setHTML(`<strong>${providerName}</strong><p>On the way to you</p>`))
        .addTo(map.current);
    }

    // Fit bounds to show both markers with padding
    const bounds = new mapboxgl.LngLatBounds()
      .extend([customerLocation.lng, customerLocation.lat])
      .extend([longitude, latitude]);
    
    map.current.fitBounds(bounds, {
      padding: { top: 100, bottom: 50, left: 50, right: 50 },
      maxZoom: 15,
      duration: 1000,
    });
  }, [providerLocation, customerLocation, animateMarker, mapToken, providerName]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const { data } = await supabase
      .from('provider_locations')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();
    
    if (data) {
      setProviderLocation(data);
      setLastUpdate(new Date());
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  if (tokenLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden shadow-lg">
      <CardContent className="p-0">
        {/* Status Bar */}
        <div className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
                <Navigation2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{providerName}</h3>
                {providerLocation ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Live tracking
                    </span>
                    <span className="text-xs text-muted-foreground">• {formatLastUpdate()}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for provider to start tracking...</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {distance !== null && providerLocation && (
                <div className="text-right mr-2">
                  <Badge variant="secondary" className="mb-1 bg-primary/10 text-primary border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    {estimateArrival(distance, providerLocation.speed)}
                  </Badge>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <MapPin className="w-3 h-3" />
                    {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
                  </p>
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Map */}
        <div ref={mapContainer} className="h-80 w-full" />

        {/* Legend */}
        <div className="p-3 bg-muted/30 flex items-center justify-center gap-8 text-sm border-t">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full shadow-md flex items-center justify-center">
              <Navigation className="w-3 h-3 text-white" />
            </div>
            <span className="text-muted-foreground font-medium">Provider</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-green-700 rounded-full shadow-md flex items-center justify-center">
              <MapPin className="w-3 h-3 text-white" />
            </div>
            <span className="text-muted-foreground font-medium">Your Location</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveTrackingMap;