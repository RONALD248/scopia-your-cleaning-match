import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Crosshair, Search, Loader2, Check, X } from 'lucide-react';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
  className?: string;
}

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
}

const LocationPicker = ({ onLocationSelect, initialLat, initialLng, className = '' }: LocationPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address?: string } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { token: mapToken, loading: tokenLoading, error: tokenError } = useMapboxToken();

  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    // Default to Nairobi, Kenya
    const defaultLat = initialLat || -1.2921;
    const defaultLng = initialLng || 36.8219;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [defaultLng, defaultLat],
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Create custom marker element
    const markerEl = document.createElement('div');
    markerEl.innerHTML = `
      <div style="position: relative;">
        <div style="
          position: absolute;
          width: 60px;
          height: 60px;
          background: rgba(255, 107, 53, 0.2);
          border-radius: 50%;
          animation: markerPulse 2s ease-out infinite;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        "></div>
        <div style="
          position: relative;
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, hsl(20, 100%, 50%) 0%, hsl(20, 100%, 40%) 100%);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          background: rgba(0,0,0,0.2);
          border-radius: 50%;
          filter: blur(2px);
        "></div>
      </div>
      <style>
        @keyframes markerPulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
      </style>
    `;

    // Add marker
    marker.current = new mapboxgl.Marker({ element: markerEl, draggable: true, anchor: 'center' })
      .setLngLat([defaultLng, defaultLat])
      .addTo(map.current);

    // Handle marker drag
    marker.current.on('dragend', () => {
      const lngLat = marker.current?.getLngLat();
      if (lngLat) {
        setCurrentLocation({ lat: lngLat.lat, lng: lngLat.lng });
        reverseGeocode(lngLat.lat, lngLat.lng);
      }
    });

    // Handle map click
    map.current.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      marker.current?.setLngLat([lng, lat]);
      setCurrentLocation({ lat, lng });
      reverseGeocode(lat, lng);
    });

    // If initial location provided, reverse geocode it
    if (initialLat && initialLng) {
      reverseGeocode(initialLat, initialLng);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapToken, initialLat, initialLng]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!mapToken) return;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapToken}&types=address,place,locality,neighborhood`
      );
      const data = await response.json();
      const address = data.features?.[0]?.place_name || '';
      setCurrentLocation(prev => prev ? { ...prev, address } : { lat, lng, address });
      onLocationSelect(lat, lng, address);
    } catch (error) {
      onLocationSelect(lat, lng);
    }
  }, [mapToken, onLocationSelect]);

  const searchPlaces = useCallback(async (query: string) => {
    if (!mapToken || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapToken}&country=ke&limit=5&types=address,place,locality,neighborhood,poi`
      );
      const data = await response.json();
      setSearchResults(data.features?.map((f: any) => ({
        id: f.id,
        place_name: f.place_name,
        center: f.center,
      })) || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [mapToken]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  const selectSearchResult = (result: SearchResult) => {
    const [lng, lat] = result.center;
    marker.current?.setLngLat([lng, lat]);
    map.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
    setCurrentLocation({ lat, lng, address: result.place_name });
    onLocationSelect(lat, lng, result.place_name);
    setShowResults(false);
    setSearchQuery(result.place_name);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        marker.current?.setLngLat([longitude, latitude]);
        map.current?.flyTo({ center: [longitude, latitude], zoom: 15, duration: 1000 });
        reverseGeocode(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please select manually on the map or search for an address.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const clearLocation = () => {
    setCurrentLocation(null);
    setSearchQuery('');
    onLocationSelect(0, 0, '');
  };

  if (tokenLoading) {
    return (
      <div className={`bg-muted rounded-lg h-[300px] flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (tokenError || !mapToken) {
    return (
      <div className={`bg-muted rounded-lg p-8 text-center ${className}`}>
        <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Map unavailable. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden shadow-lg border border-border ${className}`}>
      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for an address..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            className="pl-10 pr-10 bg-background/95 backdrop-blur-sm shadow-lg border-border/50"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {searchQuery && !isSearching && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border border-border/50 overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => selectSearchResult(result)}
                className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">{result.place_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapContainer} className="w-full h-[300px]" />
      
      {/* Use My Location Button */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute bottom-4 right-4 shadow-lg bg-background/95 backdrop-blur-sm hover:bg-background"
        onClick={getCurrentLocation}
        disabled={isLocating}
      >
        <Crosshair className={`w-4 h-4 mr-2 ${isLocating ? 'animate-pulse' : ''}`} />
        {isLocating ? 'Locating...' : 'Use My Location'}
      </Button>
      
      {/* Location Status */}
      {currentLocation && currentLocation.address && (
        <div className="absolute bottom-4 left-4 right-24 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-muted-foreground">Selected location</p>
              <p className="text-sm font-medium truncate">{currentLocation.address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Overlay (shown when no location selected) */}
      {!currentLocation && (
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg border border-border/50">
          <p className="text-sm text-muted-foreground">
            🗺️ Click on the map, drag the pin, or search to select your location
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;