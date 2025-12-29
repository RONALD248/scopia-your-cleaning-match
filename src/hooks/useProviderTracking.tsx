import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProviderLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

export const useProviderTracking = (providerId: string | null, bookingId: string | null) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<ProviderLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startTracking = useCallback(async () => {
    if (!providerId || !bookingId) return;
    
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    toast.success('Live tracking started');

    // Watch position and update in real-time
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const locationData = {
          provider_id: providerId,
          booking_id: bookingId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
        };

        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
        });

        // Upsert location to database
        const { error } = await supabase
          .from('provider_locations')
          .upsert(locationData, {
            onConflict: 'provider_id,booking_id',
          });

        if (error) {
          console.error('Error updating location:', error);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        toast.error('Failed to get your location');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [providerId, bookingId]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Remove location from database
    if (providerId && bookingId) {
      await supabase
        .from('provider_locations')
        .delete()
        .eq('provider_id', providerId)
        .eq('booking_id', bookingId);
    }

    setIsTracking(false);
    setCurrentLocation(null);
    toast.success('Tracking stopped');
  }, [providerId, bookingId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    currentLocation,
    startTracking,
    stopTracking,
  };
};
