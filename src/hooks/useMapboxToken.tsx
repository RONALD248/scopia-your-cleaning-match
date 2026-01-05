import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

export const useMapboxToken = () => {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [loading, setLoading] = useState(!cachedToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      // Return cached token immediately
      if (cachedToken) {
        setToken(cachedToken);
        setLoading(false);
        return;
      }

      // If a request is already in flight, wait for it
      if (tokenPromise) {
        try {
          const result = await tokenPromise;
          setToken(result);
          setLoading(false);
        } catch (err) {
          setError('Failed to fetch Mapbox token');
          setLoading(false);
        }
        return;
      }

      // Make the request and cache the promise
      tokenPromise = (async () => {
        try {
          const { data, error: fnError } = await supabase.functions.invoke('get-mapbox-token');
          
          if (fnError) throw fnError;
          
          if (data?.token) {
            cachedToken = data.token;
            return data.token;
          }
          return null;
        } catch (err) {
          throw err;
        } finally {
          tokenPromise = null;
        }
      })();

      try {
        const result = await tokenPromise;
        setToken(result);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch Mapbox token');
        setLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, loading, error };
};

export default useMapboxToken;