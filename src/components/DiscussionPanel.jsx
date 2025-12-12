import React, { useState, useRef, useEffect } from 'react';
import { aiDiscussionResponseGenerator } from '../ai/aiContentGenerator';
import Markdown from './Markdown';

export default function DiscussionPanel({ isOpen, onClose, topicTitle, topicContent, user }) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const apiKey = user.getSetting('geminiApiKey');
    if (!apiKey) {
      alert('Please configure your Gemini API key in settings to use the discussion feature.');
      return;
    }

    const userMessage = userInput.trim();
    setUserInput('');

    // Add user message to conversation
    const newMessages = [...messages, { type: 'user', content: userMessage, timestamp: Date.now() }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await aiDiscussionResponseGenerator(apiKey, topicTitle, topicContent, newMessages);
      setMessages((prev) => [
        ...prev,
        {
          type: 'model',
          content: response,
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Sorry, I encountered an error: ${error.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-300 shadow-lg z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-800">Discuss Topic</h3>
          <p className="text-sm text-gray-600 truncate" title={topicTitle}>
            {topicTitle}
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
            <p className="mb-2">💬</p>
            <p className="text-sm">
              Ask questions about this topic!
              <br />
              I'll help explain concepts and provide additional insights.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.timestamp} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 border-2 ${message.type === 'user' ? 'border-blue-500 bg-blue-600 text-white' : message.type === 'error' ? 'border-red-700' : 'border-gray-400'} overflow-auto break-words`}>
              {message.type === 'user' ? (
                <div>{message.content}</div>
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
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input ref={inputRef} type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask a question about this topic..." className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isLoading} />
          <button type="submit" disabled={!userInput.trim() || isLoading} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
            Send
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Press Enter to send • Requires Gemini API key</p>
      </form>
    </div>
  );
}
