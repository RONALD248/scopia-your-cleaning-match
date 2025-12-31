import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers not supported');
    }

    // Register the service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    return registration;
  };

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to enable notifications');
      return false;
    }

    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    setLoading(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        setLoading(false);
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();

      // Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
        'push-notification',
        { body: { action: 'get-vapid-key' } }
      );

      if (vapidError || !vapidData?.publicKey) {
        throw new Error('Failed to get VAPID key');
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      console.log('Push subscription created:', subscription);

      // Save subscription to backend
      const { data: session } = await supabase.auth.getSession();
      
      const { error: saveError } = await supabase.functions.invoke(
        'push-notification',
        {
          body: {
            action: 'subscribe',
            subscription: subscription.toJSON(),
          },
          headers: {
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
        }
      );

      if (saveError) {
        throw saveError;
      }

      setIsSubscribed(true);
      toast.success('Notifications enabled!');
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Failed to enable notifications');
      setLoading(false);
      return false;
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        toast.success('Notifications disabled');
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to disable notifications');
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer as ArrayBuffer;
}

// Helper function to send a notification to a user
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  try {
    const { error } = await supabase.functions.invoke('push-notification', {
      body: {
        action: 'send',
        userId,
        title,
        body,
        data,
      },
    });

    if (error) {
      console.error('Error sending push notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};
