import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChatWindowProps {
  bookingId: string;
  otherPartyName: string;
  onBack?: () => void;
}

const ChatWindow = ({ bookingId, otherPartyName, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    if (!bookingId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
      
      // Mark unread messages as read
      if (user && data) {
        const unreadIds = data
          .filter(m => m.sender_id !== user.id && !m.is_read)
          .map(m => m.id);
        
        if (unreadIds.length > 0) {
          await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }
    };

    fetchMessages();
  }, [bookingId, user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`chat-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMsg]);
          
          // Mark as read if from other party
          if (user && newMsg.sender_id !== user.id) {
            supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        message: newMessage.trim(),
      });

    if (error) {
      console.error('Error sending message:', error);
    } else {
      setNewMessage('');
    }
    
    setSending(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'h:mm a');
    }
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="flex-shrink-0 border-b py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <CardTitle className="text-lg">{otherPartyName}</CardTitle>
            <p className="text-sm text-muted-foreground">Chat</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No messages yet</p>
                <p className="text-sm">Send a message to start the conversation</p>
              </div>
            )}
            
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isOwnMessage
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.message}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <form onSubmit={sendMessage} className="flex-shrink-0 p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" disabled={!newMessage.trim() || sending} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ChatWindow;
