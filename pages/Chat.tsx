import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { FileText, Send, ArrowLeft, Loader, User, Bot, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserProfile from '../components/UserProfile';
const apiUrl = import.meta.env.VITE_BACKEND_API;

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  metadata?: {
    context_chunks_used?: number;
    similarity_scores?: number[];
    chunks_metadata?: Array<{
      chunk_index: string;
      similarity_score: number;
    }>;
  };
}

interface DocumentInfo {
  id: string;
  uuid: string;
  name: string;
  size_mb: string;
  page_count: number;
  indexing_status: string;
  total_chunks: number;
  successful_chunks: string | number;
  cloudinary_url?: string;
  storage_type?: string;
}

const Chat = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/signin');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Load document info on mount
  useEffect(() => {
    if (uuid && isAuthenticated) {
      loadDocumentInfo();
    }
  }, [uuid, isAuthenticated]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadDocumentInfo = async () => {
    setLoadingDoc(true);
    setError(null);

    try {
      const token = localStorage.getItem('chatdoc_token') || localStorage.getItem('token');
      console.log('Token found:', !!token);
      console.log('UUID:', uuid);

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const url = `${apiUrl}/api/v1/pdf/info/${uuid}`;
      console.log('Fetching document info from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      // Get response text first to see raw response
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          throw new Error('Invalid JSON response from server');
        }

        console.log('Parsed response data:', data);

        if (data.success && data.pdf) {
          setDocumentInfo(data.pdf);

          // Add welcome message
          const welcomeMessage: Message = {
            id: 'welcome',
            type: 'ai',
            content: `Hello! I'm ready to help you with questions about "${data.pdf.name}". This document has ${data.pdf.page_count} pages and ${data.pdf.successful_chunks} indexed chunks${data.pdf.storage_type === 'cloudinary' ? ', securely stored in Cloudinary' : ''}. What would you like to know?`,
            timestamp: new Date()
          };
          setMessages([welcomeMessage]);
        } else {
          console.error('Invalid response structure:', data);
          throw new Error(data.message || 'Invalid response structure from server');
        }
      } else {
        console.error('HTTP error response:', response.status, responseText);

        if (response.status === 404) {
          throw new Error(`Document not found (UUID: ${uuid}). Please check if the document exists and you have permission to access it.`);
        }

        let errorData = {};
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('Could not parse error response as JSON');
        }

        // @ts-ignore
        throw new Error(errorData.message || `Server error: ${response.status} - ${responseText}`);
      }
    } catch (error) {
      console.error('Complete error details:', error);
      setError(error instanceof Error ? error.message : 'Failed to load document');
    } finally {
      setLoadingDoc(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('chatdoc_token') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // FIX: Use 'query' instead of 'message' to match your backend API
      const response = await fetch(`${apiUrl}/api/v1/pdf/ask/${uuid}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content  // This matches your Postman test
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.answer) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: data.answer,
            timestamp: new Date(),
            metadata: {
              context_chunks_used: data.context_chunks_used,
              similarity_scores: data.similarity_scores,
              chunks_metadata: data.chunks_metadata
            }
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          throw new Error(data.message || 'Failed to get response');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDownloadPDF = (cloudinaryUrl: string, fileName: string) => {
    // Open Cloudinary URL in new tab for download
    const link = document.createElement('a');
    link.href = cloudinaryUrl;
    link.target = '_blank';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading || loadingDoc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Document Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col ">
      {/* Top Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-blue-600 hover:text-blue-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back to Dashboard</span>
              </button>

              <div className="h-6 w-px bg-gray-300"></div>

              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-black">ChatDoc</span>
                  {documentInfo && (
                    <p className="text-sm text-gray-600">
                      Chat with: {documentInfo.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <UserProfile />
            </div>
          </div>
        </div>
      </nav>

      {/* Document Info Bar */}
      {documentInfo && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">{documentInfo.name}</h3>
                <div className="flex items-center space-x-4 text-sm text-blue-700">
                  <span>{documentInfo.size_mb} MB • {documentInfo.page_count} pages • {documentInfo.successful_chunks} chunks indexed</span>
                  {documentInfo.storage_type === 'cloudinary' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      ☁️ Cloudinary
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-blue-700">
                Ready for questions
              </div>
              {documentInfo.cloudinary_url && (
                <button
                  onClick={() => handleDownloadPDF(documentInfo.cloudinary_url!, documentInfo.name)}
                  className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto px-6 py-6">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-6 mb-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.type === 'user'
                      ? 'bg-blue-600'
                      : 'bg-blue-600'
                      }`}>
                      {message.type === 'user' ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-3 ${message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                      }`}>
                      <div className="prose prose-sm leading-relaxed">

                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      </div>


                      {/* Metadata for AI responses */}
                      {message.type === 'ai' && message.metadata && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {message.metadata.context_chunks_used && (
                              <span>📄 {message.metadata.context_chunks_used} chunks used</span>
                            )}
                            {message.metadata.similarity_scores && message.metadata.similarity_scores.length > 0 && (
                              <span>🎯 {(message.metadata.similarity_scores[0] * 100).toFixed(1)}% relevance</span>
                            )}
                          </div>
                        </div>
                      )}

                      <p className={`text-xs mt-2 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3 max-w-3xl">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white text-gray-800 shadow-sm border border-gray-200 rounded-2xl px-4 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="flex-shrink-0 bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
              <div className="flex items-end space-x-4">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question about your document..."
                    className="w-full resize-none border-0 focus:ring-0 focus:outline-none text-gray-800 placeholder-gray-500 bg-transparent"
                    rows={1}
                    style={{ minHeight: '24px', maxHeight: '120px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
