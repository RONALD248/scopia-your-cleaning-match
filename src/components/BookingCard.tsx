import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Calendar, Clock, MapPin, MessageCircle, Navigation, 
  XCircle, CheckCircle, Phone, MoreVertical, Star,
  AlertTriangle, Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

interface BookingCardProps {
  booking: {
    id: string;
    status: string;
    scheduled_date: string;
    scheduled_time: string;
    address: string;
    duration_hours: number | null;
    total_amount: number | null;
    notes: string | null;
    provider_id: string;
    providers: {
      business_name: string;
      provider_type: string;
      hourly_rate: number | null;
    };
  };
  onUpdate: () => void;
}

const providerTypeLabels: Record<string, string> = {
  cleaner: 'Cleaner',
  cleaning_company: 'Cleaning Company',
  mama_fua: 'Mama Fua',
  moving_company: 'Moving Company',
};

const statusConfig: Record<string, { 
  color: string; 
  icon: React.ReactNode; 
  label: string;
  description: string;
}> = {
  pending: {
    color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
    label: 'Pending',
    description: 'Waiting for provider confirmation'
  },
  accepted: {
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Accepted',
    description: 'Provider confirmed your booking'
  },
  in_progress: {
    color: 'bg-primary/10 text-primary border-primary/20',
    icon: <Navigation className="w-3 h-3" />,
    label: 'In Progress',
    description: 'Service is currently being provided'
  },
  completed: {
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Completed',
    description: 'Service completed successfully'
  },
  cancelled: {
    color: 'bg-red-500/10 text-red-600 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
    label: 'Cancelled',
    description: 'This booking was cancelled'
  },
};

const BookingCard = ({ booking, onUpdate }: BookingCardProps) => {
  const navigate = useNavigate();
  const [isCancelling, setIsCancelling] = useState(false);

  const status = statusConfig[booking.status] || statusConfig.pending;
  const scheduledDate = parseISO(booking.scheduled_date);
  const isBookingToday = isToday(scheduledDate);
  const isBookingTomorrow = isTomorrow(scheduledDate);
  const isBookingPast = isPast(scheduledDate) && !isBookingToday;

  const getDateLabel = () => {
    if (isBookingToday) return 'Today';
    if (isBookingTomorrow) return 'Tomorrow';
    return format(scheduledDate, 'EEE, MMM d');
  };

  const handleCancelBooking = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) throw error;
      toast.success('Booking cancelled successfully');
      onUpdate();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = booking.status === 'pending';
  const canTrack = booking.status === 'accepted' || booking.status === 'in_progress';
  const canChat = booking.status !== 'pending' && booking.status !== 'cancelled';
  const canReview = booking.status === 'completed';

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${
      isBookingToday && booking.status !== 'cancelled' && booking.status !== 'completed'
        ? 'ring-2 ring-primary/30 border-primary/30'
        : ''
    }`}>
      <CardContent className="p-0">
        {/* Status Bar */}
        <div className={`px-4 py-2 flex items-center justify-between ${status.color} border-b`}>
          <div className="flex items-center gap-2">
            {status.icon}
            <span className="text-sm font-medium">{status.label}</span>
            <span className="text-xs opacity-75">• {status.description}</span>
          </div>
          {isBookingToday && booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <Badge variant="destructive" className="text-xs animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Today
            </Badge>
          )}
        </div>

        {/* Main Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Provider Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {booking.providers?.business_name}
              </h3>
              <p className="text-muted-foreground text-sm">
                {providerTypeLabels[booking.providers?.provider_type]}
              </p>
            </div>

            {/* Quick Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canChat && (
                  <DropdownMenuItem onClick={() => navigate(`/chat/${booking.id}`)}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat with Provider
                  </DropdownMenuItem>
                )}
                {canTrack && (
                  <DropdownMenuItem onClick={() => navigate(`/track/${booking.id}`)}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Track Provider
                  </DropdownMenuItem>
                )}
                {canReview && (
                  <DropdownMenuItem onClick={() => navigate(`/review/${booking.id}`)}>
                    <Star className="w-4 h-4 mr-2" />
                    Leave Review
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`/book/${booking.provider_id}`)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Again
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Booking Details */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className={isBookingToday ? 'text-primary font-medium' : ''}>
                {getDateLabel()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{booking.scheduled_time}</span>
              {booking.duration_hours && (
                <span className="text-xs">({booking.duration_hours}hrs)</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{booking.address}</span>
            </div>
          </div>

          {/* Amount */}
          {booking.total_amount && (
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <span className="font-semibold text-lg">
                KES {booking.total_amount.toLocaleString()}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {canTrack && (
              <Button 
                size="sm"
                onClick={() => navigate(`/track/${booking.id}`)}
                className="flex-1"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Track Provider
              </Button>
            )}
            
            {canChat && (
              <Button 
                variant={canTrack ? "outline" : "default"}
                size="sm"
                onClick={() => navigate(`/chat/${booking.id}`)}
                className={canTrack ? "" : "flex-1"}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
            )}

            {canReview && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate(`/review/${booking.id}`)}
                className="flex-1"
              >
                <Star className="w-4 h-4 mr-2" />
                Leave Review
              </Button>
            )}

            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isCancelling ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this booking with{' '}
                      <strong>{booking.providers?.business_name}</strong> scheduled for{' '}
                      <strong>{getDateLabel()} at {booking.scheduled_time}</strong>?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelBooking}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Cancel Booking
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {booking.status === 'pending' && (
              <span className="text-xs text-muted-foreground italic ml-auto">
                Awaiting provider response...
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookingCard;
