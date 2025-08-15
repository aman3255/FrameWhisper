import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { videoApi, logout } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Send, LogOut, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export function ChatInterface() {
  const { videoId } = useParams<{ videoId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!videoId) {
      navigate('/upload');
      return;
    }

    // Add welcome message
    setMessages([
      {
        id: '1',
        content: "Hello! I'm ready to answer questions about your video. What would you like to know?",
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  }, [videoId, navigate]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuery.trim() || isLoading || !videoId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentQuery,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentQuery('');
    setIsLoading(true);

    try {
      const response = await videoApi.query(videoId, currentQuery);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I couldn't process your question. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        variant: "destructive",
        title: "Query failed",
        description: error.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm shadow-soft">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-semibold text-lg">Video Chat</h1>
              <p className="text-sm text-muted-foreground">ID: {videoId}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <Card
                  className={`
                    max-w-[80%] ${message.isUser 
                      ? 'bg-primary text-primary-foreground shadow-elegant' 
                      : 'bg-card shadow-soft'
                    }
                  `}
                >
                  <CardContent className="p-4">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className={`
                      text-xs mt-2 ${message.isUser 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                      }
                    `}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <Card className="bg-card shadow-soft">
                  <CardContent className="p-4 flex items-center gap-3">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-muted-foreground">
                      Analyzing video...
                    </span>
                  </CardContent>
                </Card>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <Input
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              placeholder="Ask a question about your video..."
              disabled={isLoading}
              className="flex-1 rounded-xl"
            />
            <Button
              type="submit"
              disabled={isLoading || !currentQuery.trim()}
              variant="hero"
              size="icon"
              className="rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}