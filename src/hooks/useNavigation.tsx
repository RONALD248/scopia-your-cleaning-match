import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NavigationStep {
  instruction: string;
  distance: number;
  duration: number;
  type: string;
  modifier?: string;
  name: string;
  voiceInstruction: string;
  geometry: any;
  intersections: number;
}

export interface NavigationRoute {
  duration: number;
  distance: number;
  geometry: any;
  steps: NavigationStep[];
  waypoints: Array<{ name: string; location: { lng: number; lat: number } }>;
}

interface UseNavigationProps {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  enabled?: boolean;
}

export const useNavigation = ({ origin, destination, enabled = true }: UseNavigationProps) => {
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const lastFetchRef = useRef<string>('');

  const fetchDirections = useCallback(async () => {
    if (!origin || !destination || !enabled) {
      return;
    }

    // Avoid refetching for the same coordinates
    const coordKey = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;
    if (coordKey === lastFetchRef.current && route) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-directions', {
        body: { origin, destination, profile: 'driving' }
      });

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
        setRoute(null);
      } else {
        setRoute(data);
        setCurrentStepIndex(0);
        lastFetchRef.current = coordKey;
      }
    } catch (err) {
      console.error('Error fetching directions:', err);
      setError('Failed to get directions');
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, enabled, route]);

  // Fetch directions when origin or destination changes significantly
  useEffect(() => {
    if (origin && destination && enabled) {
      fetchDirections();
    }
  }, [fetchDirections]);

  // Update current step based on distance to next waypoint
  const updateCurrentStep = useCallback((currentPosition: { lat: number; lng: number }) => {
    if (!route || !route.steps.length) return;

    // Find the closest step based on distance
    let minDistance = Infinity;
    let closestStepIndex = currentStepIndex;

    for (let i = currentStepIndex; i < route.steps.length; i++) {
      const step = route.steps[i];
      if (step.geometry?.coordinates?.length > 0) {
        const stepStart = step.geometry.coordinates[0];
        const distance = getDistance(
          currentPosition.lat,
          currentPosition.lng,
          stepStart[1],
          stepStart[0]
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = i;
        }
      }
    }

    // If we're within 30 meters of the next step, advance
    if (closestStepIndex > currentStepIndex && minDistance < 30) {
      setCurrentStepIndex(closestStepIndex);
    }
  }, [route, currentStepIndex]);

  const goToNextStep = useCallback(() => {
    if (route && currentStepIndex < route.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [route, currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const refreshRoute = useCallback(() => {
    lastFetchRef.current = '';
    fetchDirections();
  }, [fetchDirections]);

  return {
    route,
    loading,
    error,
    currentStep: route?.steps[currentStepIndex] || null,
    currentStepIndex,
    totalSteps: route?.steps.length || 0,
    updateCurrentStep,
    goToNextStep,
    goToPreviousStep,
    refreshRoute,
  };
};

// Haversine formula for distance calculation
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default useNavigation;
