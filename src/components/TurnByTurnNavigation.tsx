import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useNavigation, NavigationStep } from '@/hooks/useNavigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Navigation, ChevronLeft, ChevronRight, RefreshCw, 
  ArrowUp, CornerUpLeft, CornerUpRight, RotateCcw, 
  MapPin, Clock, Route, Volume2, VolumeX,
  ArrowUpRight, ArrowUpLeft, Milestone
} from 'lucide-react';

interface TurnByTurnNavigationProps {
  providerLocation: { lat: number; lng: number } | null;
  customerLocation: { lat: number; lng: number };
  onClose?: () => void;
}

const TurnByTurnNavigation: React.FC<TurnByTurnNavigationProps> = ({
  providerLocation,
  customerLocation,
  onClose,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const providerMarker = useRef<mapboxgl.Marker | null>(null);
  const customerMarker = useRef<mapboxgl.Marker | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastSpokenRef = useRef<string>('');

  const { token, loading: tokenLoading } = useMapboxToken();
  
  const {
    route,
    loading: routeLoading,
    error,
    currentStep,
    currentStepIndex,
    totalSteps,
    goToNextStep,
    goToPreviousStep,
    refreshRoute,
    updateCurrentStep,
  } = useNavigation({
    origin: providerLocation,
    destination: customerLocation,
    enabled: !!providerLocation,
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token || map.current) return;

    mapboxgl.accessToken = token;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [customerLocation.lng, customerLocation.lat],
      zoom: 15,
      pitch: 60,
      bearing: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    // Add customer marker
    const customerEl = document.createElement('div');
    customerEl.className = 'customer-destination-marker';
    customerEl.innerHTML = `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #10b981, #059669);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
      ">
        📍
      </div>
    `;
    
    customerMarker.current = new mapboxgl.Marker({ element: customerEl })
      .setLngLat([customerLocation.lng, customerLocation.lat])
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [token, customerLocation]);

  // Update provider marker position
  useEffect(() => {
    if (!map.current || !providerLocation) return;

    if (!providerMarker.current) {
      const providerEl = document.createElement('div');
      providerEl.className = 'provider-nav-marker';
      providerEl.innerHTML = `
        <div style="
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <polygon points="12,2 19,21 12,17 5,21"></polygon>
          </svg>
        </div>
      `;
      
      providerMarker.current = new mapboxgl.Marker({ 
        element: providerEl,
        rotationAlignment: 'map'
      })
        .setLngLat([providerLocation.lng, providerLocation.lat])
        .addTo(map.current);
    } else {
      providerMarker.current.setLngLat([providerLocation.lng, providerLocation.lat]);
    }

    // Center map on provider with navigation orientation
    map.current.easeTo({
      center: [providerLocation.lng, providerLocation.lat],
      duration: 500,
    });

    // Update current navigation step
    updateCurrentStep(providerLocation);
  }, [providerLocation, updateCurrentStep]);

  // Draw route on map
  useEffect(() => {
    if (!map.current || !route?.geometry) return;

    const addRoute = () => {
      // Remove existing route if any
      if (map.current?.getSource('navigation-route')) {
        map.current.removeLayer('navigation-route-line');
        map.current.removeLayer('navigation-route-casing');
        map.current.removeSource('navigation-route');
      }

      // Add route source
      map.current?.addSource('navigation-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        },
      });

      // Add route casing (outline)
      map.current?.addLayer({
        id: 'navigation-route-casing',
        type: 'line',
        source: 'navigation-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#1e40af',
          'line-width': 12,
        },
      });

      // Add main route line
      map.current?.addLayer({
        id: 'navigation-route-line',
        type: 'line',
        source: 'navigation-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
        },
      });

      // Fit bounds to show entire route
      if (route.geometry.coordinates?.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        route.geometry.coordinates.forEach((coord: [number, number]) => {
          bounds.extend(coord);
        });
        map.current?.fitBounds(bounds, { padding: 80, pitch: 60 });
      }
    };

    if (map.current.isStyleLoaded()) {
      addRoute();
    } else {
      map.current.on('load', addRoute);
    }
  }, [route]);

  // Voice instructions
  useEffect(() => {
    if (!voiceEnabled || !currentStep) return;
    
    const instruction = currentStep.voiceInstruction || currentStep.instruction;
    if (instruction && instruction !== lastSpokenRef.current) {
      lastSpokenRef.current = instruction;
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(instruction);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [currentStep, voiceEnabled]);

  const getManeuverIcon = (type: string, modifier?: string) => {
    const iconProps = { className: "w-8 h-8" };
    
    switch (type) {
      case 'turn':
        if (modifier?.includes('left')) return <CornerUpLeft {...iconProps} />;
        if (modifier?.includes('right')) return <CornerUpRight {...iconProps} />;
        return <ArrowUp {...iconProps} />;
      case 'merge':
      case 'on ramp':
        if (modifier?.includes('left')) return <ArrowUpLeft {...iconProps} />;
        return <ArrowUpRight {...iconProps} />;
      case 'off ramp':
        if (modifier?.includes('left')) return <ArrowUpLeft {...iconProps} />;
        return <ArrowUpRight {...iconProps} />;
      case 'roundabout':
        return <RotateCcw {...iconProps} />;
      case 'arrive':
        return <MapPin {...iconProps} />;
      case 'depart':
      case 'continue':
      default:
        return <ArrowUp {...iconProps} />;
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)} sec`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  if (tokenLoading) {
    return (
      <Card className="overflow-hidden">
        <Skeleton className="h-[400px] w-full" />
      </Card>
    );
  }

  if (!providerLocation) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Navigation className="w-12 h-12 animate-pulse" />
          <p>Waiting for location...</p>
          <p className="text-sm">Enable location sharing to start navigation</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation Header */}
      {route && (
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <Route className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatDuration(route.duration)}</p>
                  <p className="text-sm opacity-80">{formatDistance(route.distance)} remaining</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={refreshRoute}
                  disabled={routeLoading}
                >
                  <RefreshCw className={`w-5 h-5 ${routeLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Instruction Card */}
      {currentStep && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                {getManeuverIcon(currentStep.type, currentStep.modifier)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-semibold mb-1">{currentStep.instruction}</p>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Milestone className="w-4 h-4" />
                    {formatDistance(currentStep.distance)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(currentStep.duration)}
                  </span>
                </div>
                {currentStep.name && currentStep.name !== 'Unnamed road' && (
                  <p className="text-sm text-muted-foreground mt-1">via {currentStep.name}</p>
                )}
              </div>
            </div>

            {/* Step Navigation */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousStep}
                disabled={currentStepIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Badge variant="secondary" className="px-3 py-1">
                Step {currentStepIndex + 1} of {totalSteps}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextStep}
                disabled={currentStepIndex >= totalSteps - 1}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map */}
      <Card className="overflow-hidden">
        <div ref={mapContainer} className="h-[350px] w-full" />
      </Card>

      {/* Upcoming Steps */}
      {route && route.steps.length > currentStepIndex + 1 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Upcoming</h4>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {route.steps.slice(currentStepIndex + 1, currentStepIndex + 4).map((step, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground shrink-0">
                    {getManeuverIcon(step.type, step.modifier)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{step.instruction}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistance(step.distance)} · {formatDuration(step.duration)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refreshRoute} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TurnByTurnNavigation;
