import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Crosshair, MapPin, List, Map as MapIcon } from 'lucide-react';

interface Provider {
  id: string;
  business_name: string;
  provider_type: string;
  hourly_rate: number;
  rating: number;
  location_lat: number | null;
  location_lng: number | null;
  is_available: boolean;
}

interface ProvidersMapProps {
  providers: Provider[];
  onProviderSelect: (providerId: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  onUserLocationChange?: (lat: number, lng: number) => void;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';

const providerTypeLabels: Record<string, string> = {
  cleaner: '🧹 Cleaner',
  cleaning_company: '🏢 Cleaning Co.',
  mama_fua: '👕 Mama Fua',
  moving_company: '🚚 Moving Co.',
};

const providerTypeColors: Record<string, string> = {
  cleaner: '#10B981',
  cleaning_company: '#3B82F6',
  mama_fua: '#EC4899',
  moving_company: '#F59E0B',
};

const ProvidersMap = ({ providers, onProviderSelect, userLocation, onUserLocationChange }: ProvidersMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Default to Nairobi, Kenya
    const centerLat = userLocation?.lat || -1.2921;
    const centerLng = userLocation?.lng || 36.8219;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update markers when providers or map changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add provider markers
    providers.forEach((provider) => {
      if (provider.location_lat && provider.location_lng && provider.is_available) {
        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'provider-marker';
        el.style.cssText = `
          width: 40px;
          height: 40px;
          background: ${providerTypeColors[provider.provider_type] || '#FF6B35'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: transform 0.2s;
        `;
        
        const icon = provider.provider_type === 'cleaner' ? '🧹' : 
                     provider.provider_type === 'cleaning_company' ? '🏢' :
                     provider.provider_type === 'mama_fua' ? '👕' : '🚚';
        el.innerHTML = icon;
        
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px; min-width: 150px;">
            <h3 style="font-weight: 600; margin-bottom: 4px;">${provider.business_name}</h3>
            <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${providerTypeLabels[provider.provider_type]}</p>
            <p style="font-size: 12px; color: #666;">⭐ ${provider.rating || 'New'} • KES ${provider.hourly_rate || '---'}/hr</p>
            <button onclick="window.selectProvider('${provider.id}')" style="
              margin-top: 8px;
              width: 100%;
              padding: 6px 12px;
              background: #FF6B35;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
            ">Book Now</button>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([provider.location_lng, provider.location_lat])
          .setPopup(popup)
          .addTo(map.current!);

        el.addEventListener('click', () => {
          marker.togglePopup();
        });

        markersRef.current.push(marker);
      }
    });

    // Global function for popup button
    (window as any).selectProvider = (id: string) => {
      onProviderSelect(id);
    };

    return () => {
      delete (window as any).selectProvider;
    };
  }, [providers, mapLoaded, onProviderSelect]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      } else {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 20px;
          height: 20px;
          background: #3B82F6;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2);
        `;

        userMarkerRef.current = new mapboxgl.Marker(el)
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current);
      }

      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 13,
      });
    }
  }, [userLocation, mapLoaded]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onUserLocationChange?.(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please try again.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="bg-muted rounded-lg p-8 text-center h-[400px] flex items-center justify-center">
        <div>
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Map unavailable. Please configure Mapbox token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-[400px] rounded-lg overflow-hidden shadow-lg" />
      
      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-4 right-4 shadow-lg"
        onClick={getCurrentLocation}
        disabled={isLocating}
      >
        <Crosshair className={`w-4 h-4 mr-2 ${isLocating ? 'animate-pulse' : ''}`} />
        {isLocating ? 'Locating...' : 'Find My Location'}
      </Button>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <p className="text-xs font-semibold mb-2 text-muted-foreground">Providers</p>
        <div className="space-y-1 text-xs">
          {Object.entries(providerTypeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span 
                className="w-3 h-3 rounded-full" 
                style={{ background: providerTypeColors[key] }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProvidersMap;
