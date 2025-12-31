import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const NotificationSettings = () => {
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <BellOff className="w-5 h-5" />
            <span className="text-sm">Push notifications are not supported in this browser</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Get notified when providers accept your bookings or are nearby
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSubscribed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <BellRing className="w-5 h-5" />
              <span className="text-sm font-medium">Notifications enabled</span>
            </div>
            <Button variant="outline" size="sm" onClick={unsubscribe}>
              Disable
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BellOff className="w-5 h-5" />
              <span className="text-sm">
                {permission === 'denied' 
                  ? 'Notifications blocked in browser settings' 
                  : 'Notifications are disabled'}
              </span>
            </div>
            <Button 
              size="sm" 
              onClick={subscribe}
              disabled={loading || permission === 'denied'}
            >
              {loading ? 'Enabling...' : 'Enable'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
