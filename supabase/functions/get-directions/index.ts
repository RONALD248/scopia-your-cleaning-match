import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!MAPBOX_TOKEN) {
      console.error('MAPBOX_PUBLIC_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { origin, destination, profile = 'driving' } = await req.json();

    if (!origin || !destination) {
      console.error('Missing origin or destination');
      return new Response(
        JSON.stringify({ error: 'Origin and destination are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mapbox expects coordinates as "lng,lat"
    const originCoords = `${origin.lng},${origin.lat}`;
    const destinationCoords = `${destination.lng},${destination.lat}`;

    console.log(`Fetching directions from ${originCoords} to ${destinationCoords} with profile ${profile}`);

    // Call Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${originCoords};${destinationCoords}?alternatives=false&geometries=geojson&language=en&overview=full&steps=true&voice_instructions=true&voice_units=metric&access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(directionsUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('Mapbox API error:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to get directions' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.routes || data.routes.length === 0) {
      console.log('No routes found');
      return new Response(
        JSON.stringify({ error: 'No routes found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = data.routes[0];
    
    // Format the response with turn-by-turn instructions
    const formattedResponse = {
      duration: route.duration, // in seconds
      distance: route.distance, // in meters
      geometry: route.geometry, // GeoJSON LineString
      steps: route.legs[0].steps.map((step: any) => ({
        instruction: step.maneuver.instruction,
        distance: step.distance,
        duration: step.duration,
        type: step.maneuver.type,
        modifier: step.maneuver.modifier,
        name: step.name || 'Unnamed road',
        voiceInstruction: step.voiceInstructions?.[0]?.announcement || step.maneuver.instruction,
        geometry: step.geometry,
        intersections: step.intersections?.length || 0,
      })),
      waypoints: data.waypoints?.map((wp: any) => ({
        name: wp.name,
        location: { lng: wp.location[0], lat: wp.location[1] }
      }))
    };

    console.log(`Route found: ${route.distance}m, ${route.duration}s, ${formattedResponse.steps.length} steps`);

    return new Response(
      JSON.stringify(formattedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching directions:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
