import React, { useState, useRef, useEffect } from 'react';
import { aiDiscussionResponseGenerator } from '../ai/aiContentGenerator';
import Markdown from './Markdown';

export default function DiscussionPanel({ isOpen, onClose, topicTitle, topicContent, user, activeSection = null }) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('ai'); // 'ai' or 'notes'
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    inputRef.current?.focus();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModeDropdown(false);
      }
    };

    if (showModeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModeDropdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userMessage = userInput.trim();
    setUserInput('');

    if (mode === 'notes') {
      // Add note directly without AI response
      setMessages((prev) => [
        ...prev,
        {
          type: 'note',
          content: userMessage,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    // AI mode: Add user message and get AI response
    const newMessages = [...messages, { type: 'user', content: userMessage, timestamp: Date.now() }];
    setMessages(newMessages);
    setIsLoading(true);

    let type = 'model';
    let content;
    try {
      content = await aiDiscussionResponseGenerator(topicTitle, topicContent, newMessages);
    } catch (error) {
      type = 'error';
      content = `Sorry, I encountered an error: ${error.message}`;
    } finally {
      setMessages((prev) => [
        ...prev,
        {
          type,
          content,
          timestamp: Date.now(),
        },
      ]);

      setIsLoading(false);
    }
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    setShowModeDropdown(false);
    inputRef.current?.focus();
  };

  const clearConversation = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  const fullTopicTitle = activeSection ? `${topicTitle} - ${activeSection.sectionText}` : topicTitle;

  const modeConfig = {
    ai: {
      title: '🤖 AI Discussion',
      placeholder: 'Ask a question about this topic...',
      buttonText: 'Ask AI',
      emptyStateIcon: '💬',
      emptyStateText: 'Ask questions about this topic! I\'ll help explain concepts and provide additional insights.',
    },
    notes: {
      title: '📝 Topic Notes',
      placeholder: 'Write a note about this topic...',
      buttonText: 'Add Note',
      emptyStateIcon: '📓',
      emptyStateText: 'Take notes about this topic. Your notes will be saved here for future reference.',
    },
  };

  const config = modeConfig[mode];

  return (
    <div className="fixed inset-y-0 right-0 w-128 bg-white border-l border-gray-300 shadow-lg z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800">{config.title}</h3>
          <p className="text-sm text-gray-600 truncate" title={fullTopicTitle}>
            {fullTopicTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-3 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={clearConversation} title="Clear discussion">
            🔄
          </button>
          <button className="w-3 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={onClose} title="Close discussion">
            ❌
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="mb-2 text-2xl">{config.emptyStateIcon}</p>
            <p className="text-sm px-4">
              {config.emptyStateText}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.timestamp} className={`flex ${message.type === 'user' || message.type === 'note' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 border-2 ${message.type === 'user'
              ? 'border-blue-500 bg-blue-600 text-white'
              : message.type === 'note'
                ? 'border-amber-400 bg-amber-50 text-gray-800'
                : message.type === 'error'
                  ? 'border-red-700'
                  : 'border-gray-400'
              } overflow-auto break-words`}>
              {message.type === 'user' || message.type === 'note' ? (
                <div>
                  {message.type === 'note' && (
                    <div className="text-xs text-amber-600 font-medium mb-1">📝 Note</div>
                  )}
                  {message.content}
                </div>
              ) : (
                <div className="markdown-body">
                  <Markdown content={message.content} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex items-center space-x-1 text-gray-600">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={config.placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <div className="relative" ref={dropdownRef}>
            <div className="flex">
              <button
                type="submit"
                disabled={!userInput.trim() || isLoading}
                className={`px-4 py-2 ${mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                {config.buttonText}
              </button>
              <button
                type="button"
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                className={`px-2 ${mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-r-md border-l border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors`}
                title="Change mode"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {showModeDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => toggleMode('ai')}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${mode === 'ai' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'} rounded-t-md`}
                >
                  <span>🤖</span>
                  <div>
                    <div className="font-medium">AI Discussion</div>
                    <div className="text-xs text-gray-500">Ask questions & get answers</div>
                  </div>
                  {mode === 'ai' && <span className="ml-auto">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => toggleMode('notes')}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${mode === 'notes' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'} rounded-b-md`}
                >
                  <span>📝</span>
                  <div>
                    <div className="font-medium">Take Notes</div>
                    <div className="text-xs text-gray-500">Save your thoughts</div>
                  </div>
                  {mode === 'notes' && <span className="ml-auto">✓</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
