import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Crosshair, MapPin, Star, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';

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

const providerTypeLabels: Record<string, string> = {
  cleaner: 'Cleaner',
  cleaning_company: 'Cleaning Company',
  mama_fua: 'Mama Fua',
  moving_company: 'Moving Company',
};

const providerTypeIcons: Record<string, string> = {
  cleaner: '🧹',
  cleaning_company: '🏢',
  mama_fua: '👕',
  moving_company: '🚚',
};

const providerTypeColors: Record<string, { bg: string; shadow: string }> = {
  cleaner: { bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', shadow: 'rgba(16, 185, 129, 0.4)' },
  cleaning_company: { bg: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', shadow: 'rgba(59, 130, 246, 0.4)' },
  mama_fua: { bg: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', shadow: 'rgba(236, 72, 153, 0.4)' },
  moving_company: { bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', shadow: 'rgba(245, 158, 11, 0.4)' },
};

const ProvidersMap = ({ providers, onProviderSelect, userLocation, onUserLocationChange }: ProvidersMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const { token: mapToken, loading: tokenLoading, error: tokenError } = useMapboxToken();

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    // Default to Nairobi, Kenya
    const centerLat = userLocation?.lat || -1.2921;
    const centerLng = userLocation?.lng || 36.8219;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapToken, userLocation?.lat, userLocation?.lng]);

  // Update markers when providers or map changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Sort providers by distance if user location is available
    const sortedProviders = [...providers].filter(p => p.location_lat && p.location_lng && p.is_available);
    
    if (userLocation) {
      sortedProviders.sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.location_lat!, a.location_lng!);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.location_lat!, b.location_lng!);
        return distA - distB;
      });
    }

    // Add provider markers
    sortedProviders.forEach((provider, index) => {
      const colors = providerTypeColors[provider.provider_type] || { bg: 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)', shadow: 'rgba(255, 107, 53, 0.4)' };
      const icon = providerTypeIcons[provider.provider_type] || '📍';
      
      const distanceText = userLocation 
        ? `${calculateDistance(userLocation.lat, userLocation.lng, provider.location_lat!, provider.location_lng!).toFixed(1)} km away`
        : '';

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'provider-marker';
      el.style.cssText = `
        position: relative;
        width: 48px;
        height: 48px;
        cursor: pointer;
        transition: all 0.3s ease;
        z-index: ${100 - index};
      `;
      
      el.innerHTML = `
        <div style="
          width: 48px;
          height: 48px;
          background: ${colors.bg};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 15px ${colors.shadow};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          transition: all 0.3s ease;
        ">${icon}</div>
        ${provider.rating ? `
        <div style="
          position: absolute;
          top: -6px;
          right: -6px;
          background: white;
          border-radius: 12px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          color: #111;
        ">
          <span style="color: #F59E0B;">★</span>
          ${provider.rating.toFixed(1)}
        </div>
        ` : ''}
      `;
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15) translateY(-4px)';
        el.style.zIndex = '200';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1) translateY(0)';
        el.style.zIndex = `${100 - index}`;
      });

      const popup = new mapboxgl.Popup({ 
        offset: 25, 
        closeButton: true,
        maxWidth: '280px',
      }).setHTML(`
        <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="
              width: 40px;
              height: 40px;
              background: ${colors.bg};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
            ">${icon}</div>
            <div>
              <h3 style="font-weight: 600; font-size: 15px; margin: 0 0 2px 0; color: #111;">${provider.business_name}</h3>
              <p style="font-size: 12px; color: #666; margin: 0;">${providerTypeLabels[provider.provider_type]}</p>
            </div>
          </div>
          
          <div style="display: flex; gap: 12px; margin-bottom: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px;">
            <div style="text-align: center; flex: 1;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 600; color: #111;">
                <span style="color: #F59E0B;">★</span>
                ${provider.rating?.toFixed(1) || 'New'}
              </div>
              <div style="font-size: 10px; color: #888;">Rating</div>
            </div>
            <div style="width: 1px; background: #ddd;"></div>
            <div style="text-align: center; flex: 1;">
              <div style="font-weight: 600; color: #111;">KES ${provider.hourly_rate || '---'}</div>
              <div style="font-size: 10px; color: #888;">per hour</div>
            </div>
          </div>
          
          ${distanceText ? `<p style="font-size: 12px; color: #666; margin-bottom: 10px; display: flex; align-items: center; gap: 4px;">📍 ${distanceText}</p>` : ''}
          
          <button onclick="window.selectProvider('${provider.id}')" style="
            width: 100%;
            padding: 10px 16px;
            background: linear-gradient(135deg, hsl(20, 100%, 50%) 0%, hsl(20, 100%, 40%) 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
          " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.4)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(255, 107, 53, 0.3)';">
            Book Now
          </button>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([provider.location_lng!, provider.location_lat!])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        setSelectedProvider(provider.id);
        marker.togglePopup();
      });

      markersRef.current.push(marker);
    });

    // Global function for popup button
    (window as any).selectProvider = (id: string) => {
      onProviderSelect(id);
    };

    // Fit bounds to show all providers
    if (sortedProviders.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      sortedProviders.forEach(provider => {
        bounds.extend([provider.location_lng!, provider.location_lat!]);
      });
      if (userLocation) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }
      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 50, left: 50, right: 50 },
        maxZoom: 14,
        duration: 1000,
      });
    }

    return () => {
      delete (window as any).selectProvider;
    };
  }, [providers, mapLoaded, onProviderSelect, userLocation, calculateDistance]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="position: relative;">
            <div style="
              position: absolute;
              width: 40px;
              height: 40px;
              background: rgba(59, 130, 246, 0.2);
              border-radius: 50%;
              animation: userPulse 2s ease-out infinite;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            "></div>
            <div style="
              position: relative;
              width: 20px;
              height: 20px;
              background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
            "></div>
          </div>
          <style>
            @keyframes userPulse {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
            }
          </style>
        `;

        userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML('<strong>Your Location</strong>'))
          .addTo(map.current);
      }

      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 13,
        duration: 1500,
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

  if (tokenLoading) {
    return (
      <div className="bg-muted rounded-lg h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (tokenError || !mapToken) {
    return (
      <div className="bg-muted rounded-lg p-8 text-center h-[400px] flex items-center justify-center">
        <div>
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Map unavailable. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg border border-border">
      <div ref={mapContainer} className="w-full h-[400px]" />
      
      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="shadow-lg bg-background/95 backdrop-blur-sm hover:bg-background"
          onClick={getCurrentLocation}
          disabled={isLocating}
        >
          <Crosshair className={`w-4 h-4 mr-2 ${isLocating ? 'animate-pulse' : ''}`} />
          {isLocating ? 'Locating...' : 'Find Me'}
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-border/50">
        <p className="text-xs font-semibold mb-3 text-foreground flex items-center gap-2">
          <MapPin className="w-3 h-3" />
          Service Providers
        </p>
        <div className="space-y-2 text-xs">
          {Object.entries(providerTypeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-base">{providerTypeIcons[key]}</span>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Provider count badge */}
      <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
        {providers.filter(p => p.is_available && p.location_lat).length} available
      </div>
    </div>
  );
};

export default ProvidersMap;