import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push encryption implementation
async function generateWebPushPayload(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
) {
  // This is a simplified version - in production, use a proper web-push library
  // For now, we'll use the native fetch with the proper headers
  
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  // Create JWT for VAPID
  const jwtHeader = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const jwtPayload = btoa(JSON.stringify({
    aud: new URL(subscription.endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapidKeys.subject,
  }));
  
  return {
    endpoint: subscription.endpoint,
    payload: payloadBytes,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'Push notifications not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId, title, body, data, subscription } = await req.json();
    console.log('Push notification request:', { action, userId, title });

    // Initialize Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (action === 'subscribe') {
      // Save subscription to database
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user from auth header
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert subscription
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        }, {
          onConflict: 'endpoint',
        });

      if (insertError) {
        console.error('Error saving subscription:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Subscription saved for user:', user.id);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send') {
      // Send notification to user
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's subscriptions
      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (fetchError) {
        console.error('Error fetching subscriptions:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch subscriptions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log('No subscriptions found for user:', userId);
        return new Response(
          JSON.stringify({ success: true, sent: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload = JSON.stringify({
        title: title || 'SCOPIA',
        body: body || 'You have a new notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: data || {},
      });

      let sent = 0;
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          // Use native fetch with VAPID headers for web push
          // Note: This is a simplified implementation
          // For production, consider using a web-push library or external service
          
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
              'Urgency': 'high',
            },
            body: payload,
          });

          if (response.ok || response.status === 201) {
            sent++;
            console.log('Notification sent to:', sub.endpoint.substring(0, 50));
          } else {
            const errorText = await response.text();
            console.error('Push failed:', response.status, errorText);
            
            // If subscription is expired, remove it
            if (response.status === 404 || response.status === 410) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
              console.log('Removed expired subscription');
            }
          }
        } catch (error) {
          console.error('Error sending to subscription:', error);
          errors.push(String(error));
        }
      }

      console.log(`Sent ${sent}/${subscriptions.length} notifications`);
      return new Response(
        JSON.stringify({ success: true, sent, total: subscriptions.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-vapid-key') {
      // Return public VAPID key for client subscription
      return new Response(
        JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in push-notification function:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
