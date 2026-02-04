'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Phone, Calendar, FileText, Mail } from 'lucide-react';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_GREETING = "Hi! I'm here to help you learn about Voxanne AI. What brings you here today?";

const QUICK_ACTIONS = [
  { icon: Calendar, label: 'Schedule a Demo', action: 'demo' },
  { icon: FileText, label: 'View Pricing', action: 'pricing' },
  { icon: FileText, label: 'See Case Studies', action: 'cases' },
  { icon: Mail, label: 'Contact Sales', action: 'contact' },
];

export default function VoxanneChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('voxanne-chat-messages');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) {
        console.error('Failed to parse stored messages', e);
        initializeChat();
      }
    } else {
      initializeChat();
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('voxanne-chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: INITIAL_GREETING,
        timestamp: new Date(),
      },
    ]);
  };

  const handleQuickAction = async (action: string) => {
    let userMessage = '';
    switch (action) {
      case 'demo':
        userMessage = 'I want to schedule a demo';
        break;
      case 'pricing':
        userMessage = 'Can you show me the pricing plans?';
        break;
      case 'cases':
        userMessage = 'I want to see case studies and success stories';
        break;
      case 'contact':
        userMessage = 'How can I contact sales?';
        break;
      default:
        return;
    }
    await sendMessage(userMessage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    await sendMessage(inputValue);
    setInputValue('');
  };

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || "I'm having trouble right now. Please try again or contact support@voxanne.ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again or reach out to us at support@voxanne.ai or call +44 7424 038250.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            {/* Chat Button - White Background with Blue Logo */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="relative w-16 h-16 rounded-full bg-white shadow-2xl shadow-gray-400/40 ring-2 ring-gray-200/80 hover:shadow-surgical-500/50 hover:ring-surgical-400 transition-all duration-300 flex items-center justify-center"
              aria-label="Chat with Voxanne"
            >
              <Image
                src="/Brand/10.png"
                alt="Chat with Voxanne"
                width={36}
                height={36}
                className="w-9 h-9"
                priority
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[95vw] max-w-[400px] h-[90dvh] max-h-[600px] sm:w-[400px] sm:h-[600px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-clinical-border flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-surgical-600 to-surgical-500 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/Brand/10.png"
                  alt="Voxanne AI"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
                <div>
                  <h3 className="font-semibold text-base">Voxanne</h3>
                  <p className="text-xs text-white/80">Always here to help</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-lg p-2 transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-surgical-50/30 overflow-x-hidden">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-surgical-600 text-white rounded-br-sm'
                        : 'bg-white border border-surgical-200 text-obsidian rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-white/60' : 'text-obsidian/50'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-surgical-200 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                        className="w-2 h-2 bg-surgical-500 rounded-full"
                      />
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                        className="w-2 h-2 bg-surgical-500 rounded-full"
                      />
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                        className="w-2 h-2 bg-surgical-500 rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length === 1 && !isLoading && (
              <div className="p-4 border-t border-clinical-border bg-white">
                <p className="text-xs text-obsidian/60 mb-2">Quick actions:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.action}
                      onClick={() => handleQuickAction(action.action)}
                      className="flex items-center gap-2 px-3 py-2 text-xs bg-surgical-50 hover:bg-surgical-100 text-surgical-600 rounded-lg transition-colors border border-surgical-200"
                    >
                      <action.icon className="w-3.5 h-3.5" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-clinical-border bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="sentences"
                  className="flex-1 px-3 py-2 sm:px-4 sm:py-3 text-base sm:text-sm rounded-xl border border-surgical-200 focus:outline-none focus:ring-2 focus:ring-surgical-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="px-3 py-2 sm:px-4 sm:py-3 bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-obsidian/40 mt-2 text-center">
                Powered by Groq AI • Always available
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
