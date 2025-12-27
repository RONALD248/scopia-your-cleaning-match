import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Crosshair } from 'lucide-react';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
  className?: string;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';

const LocationPicker = ({ onLocationSelect, initialLat, initialLng, className = '' }: LocationPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Default to Nairobi, Kenya
    const defaultLat = initialLat || -1.2921;
    const defaultLng = initialLng || 36.8219;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [defaultLng, defaultLat],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add marker
    marker.current = new mapboxgl.Marker({ color: '#FF6B35', draggable: true })
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

    return () => {
      map.current?.remove();
    };
  }, [initialLat, initialLng]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      const address = data.features?.[0]?.place_name || '';
      onLocationSelect(lat, lng, address);
    } catch (error) {
      onLocationSelect(lat, lng);
    }
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
        map.current?.flyTo({ center: [longitude, latitude], zoom: 14 });
        reverseGeocode(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please select manually on the map.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`bg-muted rounded-lg p-8 text-center ${className}`}>
        <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Map unavailable. Please configure Mapbox token.</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-[300px] rounded-lg overflow-hidden" />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute bottom-4 right-4 shadow-lg"
        onClick={getCurrentLocation}
        disabled={isLocating}
      >
        <Crosshair className={`w-4 h-4 mr-2 ${isLocating ? 'animate-pulse' : ''}`} />
        {isLocating ? 'Locating...' : 'Use My Location'}
      </Button>
      {currentLocation && (
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg">
          <span className="text-muted-foreground">📍 Location set</span>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
