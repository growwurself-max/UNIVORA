import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, RotateCcw, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiAPI } from '../services/api';

const SUGGESTED_QUESTIONS = [
  "How do I generate a fee report?",
  "What is the attendance summary for my class?",
  "Help me create a new exam schedule.",
  "Show me the current academic year details."
];

// Renders assistant replies as Markdown. react-markdown does not evaluate raw
// HTML and sanitizes link protocols by default, so untrusted text stays safe.
const MarkdownMessage = ({ content }) => (
  <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const AIChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am Univora AI. How can I help you with your institution management today?'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await aiAPI.chat({ message: userMessage });
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question) => {
    if (isLoading) return;
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);

    (async () => {
      try {
        const response = await aiAPI.chat({ message: question });
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to get response.');
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Conversation cleared. How can I help you now?'
    }]);
    setError(null);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all active:scale-95 group"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Ask Univora AI</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="flex flex-col w-[calc(100vw-2rem)] max-w-[440px] h-[600px] max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <span className="font-semibold">Univora AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={clearChat} 
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors" 
                title="Clear Chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50"
          >
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[88%] min-w-0 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    msg.role === 'user' ? 'bg-primary-100 text-primary-700' : 'bg-white border border-gray-200 text-gray-600'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  {msg.role === 'user' ? (
                    <div className="min-w-0 px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm bg-primary-600 text-white rounded-tr-none whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="min-w-0 px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm bg-white text-gray-800 border border-gray-100 rounded-tl-none break-words">
                      <MarkdownMessage content={msg.content} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 items-center bg-white border border-gray-100 px-3 py-2 rounded-2xl rounded-tl-none shadow-sm">
                  <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                  <span className="text-xs text-gray-500">AI is thinking...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="text-center">
                <span className="inline-block text-xs text-red-500 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 break-words">
                  {error}
                </span>
              </div>
            )}
          </div>

          {/* Suggested Questions */}
          {messages.length < 3 && !isLoading && (
            <div className="px-4 py-2 bg-slate-50 border-t border-gray-100 flex flex-wrap gap-2 shrink-0">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button 
                  key={i}
                  onClick={() => handleSuggestedQuestion(q)}
                  className="text-[11px] px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded-md hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <form 
            onSubmit={handleSend} 
            className="p-3 sm:p-4 bg-white border-t border-gray-200 flex gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIChatBot;
