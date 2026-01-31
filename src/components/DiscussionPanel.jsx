import React, { useState, useRef, useEffect } from 'react';
import { Bot, FileText, RotateCcw, X, MessageCircle, Notebook } from 'lucide-react';
import { aiDiscussionResponseGenerator } from '../ai/aiContentGenerator';
import Markdown from './Markdown';

export default function DiscussionPanel({ courseOps, learningSession, isOpen, onClose, topicTitle, topicContent, user, activeHeading = null }) {
  const [allMessages, setAllMessages] = useState([]);
  const [savedMessagesLoaded, setSavedMessagesLoaded] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('ai'); // 'ai' or 'notes'
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
    inputRef.current?.focus();
  }, [visibleMessages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // Load saved notes from DB
    (async () => {
      const notes = (
        await courseOps.getProgress({
          topicId: learningSession.topic.id,
          enrollmentId: learningSession.enrollment.id,
          types: ['note'],
          limit: 100,
        })
      ).data;
      // TODO: Handle if there are more than 100 notes
      // Probably how this should work is that the most recent few notes should be loaded first,
      // and older notes are fetched if the user scrolls up to the top of the messages panel.
      const loadedMessages = notes
        .filter((p) => p.details)
        .map((p) => {
          const details = { ...p.details };
          details.timestamp = new Date(p.createdAt);
          return details;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
      setAllMessages(loadedMessages);
      setSavedMessagesLoaded(true);
    })();
  }, [learningSession.topic.id, learningSession.enrollment.id, courseOps]);

  useEffect(() => {
    // Reset visible messages when switching between modes
    const isRelevant = (m) => {
      if ((mode === 'notes' && m.type !== 'note') || (mode === 'ai' && m.type === 'note')) {
        return false;
      }
      return true;
    };
    const relevantMessages = allMessages.filter(isRelevant);
    setVisibleMessages(relevantMessages);
    // Sometimes we don't automatically scroll all the way down when loading saved notes
    // and there are lots of saved notes.
    if (relevantMessages.length > 0) {
      setTimeout(() => scrollToBottom('auto'), 200);
    }
  }, [savedMessagesLoaded, mode]);

  // Close mode select dropdown when clicking outside
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

  const handleUserNoteInput = (userMessage, addToVisibleMessages = true) => {
    console.log('Adding user note:', userMessage, 'to visible messages:', addToVisibleMessages);
    const notePayload = {
      type: 'note',
      activeHeading,
      content: userMessage,
      timestamp: Date.now(),
    };
    if (addToVisibleMessages) {
      // TODO: Why isn't this working?
      addMessage(notePayload);
    } else {
      // Just add to allMessages without showing in visibleMessages
      setAllMessages((prev) => [...prev, notePayload]);
    }

    // Save to progress table in backend
    const dataToSave = {
      type: 'note',
      activeHeading,
      content: userMessage,
    };
    courseOps.addProgress(null, null, 'note', 0, dataToSave);
  };

  const handleAIQueryInput = async (userMessage) => {
    const newMessage = { type: 'user', activeHeading, content: userMessage, timestamp: Date.now() };
    const newMessages = [...visibleMessages, newMessage];
    addMessage(newMessage);
    setIsLoading(true);

    let type = 'model';
    let content;
    try {
      content = await aiDiscussionResponseGenerator(topicTitle, topicContent, newMessages);
    } catch (error) {
      type = 'error';
      content = `Sorry, I encountered an error: ${error.message}`;
    } finally {
      addMessage({
        type,
        activeHeading,
        content,
        timestamp: Date.now(),
      });

      setIsLoading(false);
    }
  };

  const handleSaveAsNote = (messageIndex, includePreviousMessage = true) => {
    // Save both the most recent message (AI response) and optionally the previous user message (query) as a note
    // If including the previous message, concatenate both into one note
    if (messageIndex <= 0 || messageIndex >= visibleMessages.length) return;
    const messageToSave = visibleMessages[messageIndex];
    let contentToSave;
    if (includePreviousMessage && visibleMessages.length >= 2) {
      const previousMessage = visibleMessages[messageIndex - 1];
      contentToSave = `**Your Question:**\n\n${previousMessage.content}\n\n---\n\n**AI Response:**\n\n${messageToSave.content}`;
    } else {
      contentToSave = messageToSave.content;
    }

    // Save it now exactly as if it was a user note, but don't add to visible messages
    handleUserNoteInput(contentToSave, false);

    // Create a visual confirmation in the messages panel
    addMessage({
      type: 'info',
      activeHeading,
      content: 'This AI response has been saved as a note.',
      timestamp: Date.now(),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userMessage = userInput.trim();
    setUserInput('');

    // Reset size of textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    if (mode === 'notes') {
      // Add note directly without AI response
      handleUserNoteInput(userMessage);
      return;
    }

    // AI mode: Add user message and get AI response
    handleAIQueryInput(userMessage);
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    setShowModeDropdown(false);
    inputRef.current?.focus();
  };

  const addMessage = (message) => {
    setAllMessages((prev) => [...prev, message]);
    setVisibleMessages((prev) => [...prev, message]);
  };

  const clearConversation = () => {
    // Only clear non-note messages
    setAllMessages(prev => prev.filter((m) => m.type === 'note'));
    setVisibleMessages(prev => prev.filter((m) => m.type === 'note'));
  };

  if (!isOpen) return null;

  const fullTopicTitle = activeHeading ? `${topicTitle} - ${activeHeading.headingText}` : topicTitle;

  const modeConfig = {
    ai: {
      title: 'AI Discussion',
      titleIcon: Bot,
      placeholder: 'Ask a question about this topic...',
      buttonText: 'Ask AI',
      emptyStateIcon: MessageCircle,
      emptyStateText: "Ask questions about this topic! I'll help explain concepts and provide additional insights.",
    },
    notes: {
      title: 'Topic Notes',
      titleIcon: FileText,
      placeholder: 'Write a note about this topic...',
      buttonText: 'Add Note',
      emptyStateIcon: Notebook,
      emptyStateText: 'Take notes about this topic. Your notes will be saved here for future reference.',
    },
  }[mode];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-lg bg-white border-l border-gray-300 shadow-lg z-50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 truncate" title={fullTopicTitle}>
              {fullTopicTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => toggleMode('ai')} className={`px-3 py-1.5 rounded-md font-medium text-sm transition-all flex items-center gap-1.5 ${mode === 'ai' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'}`} title="Ask questions about this topic">
                <Bot size={16} /> AI
              </button>
              <button onClick={() => toggleMode('notes')} className={`px-3 py-1.5 rounded-md font-medium text-sm transition-all flex items-center gap-1.5 ${mode === 'notes' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'}`} title="Take notes on this topic">
                <FileText size={16} /> Notes
              </button>
            </div>
            <button disabled={mode !== 'ai'} className="p-1.5 rounded-sm bg-transparent border border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out cursor-pointer disabled:opacity-50 disabled:cursor-none disabled:pointer-events-none" onClick={clearConversation} title="Clear discussion">
              <RotateCcw size={16} />
            </button>
            <button className="p-1.5 rounded-sm bg-transparent border border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out cursor-pointer" onClick={onClose} title="Close discussion">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-2 flex justify-center">{React.createElement(modeConfig.emptyStateIcon, { size: 48, strokeWidth: 1.5 })}</div>
            <p className="text-sm px-4">{modeConfig.emptyStateText}</p>
          </div>
        )}

        {visibleMessages.map((message, i) => (
          <MessageBox key={message.timestamp} message={message} handleSaveAsNote={() => handleSaveAsNote(i)} />
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
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={modeConfig.placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={1}
            style={{ minHeight: '2.5rem', maxHeight: '7.5rem' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            disabled={isLoading}
          />
          <div className="relative" ref={dropdownRef}>
            <div className="flex">
              <button type="submit" disabled={!userInput.trim() || isLoading} className={`px-4 py-2 ${mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer`}>
                {modeConfig.buttonText}
              </button>
              <button type="button" onClick={() => setShowModeDropdown(!showModeDropdown)} className={`px-2 ${mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-r-md border-l border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors cursor-pointer`} title="Change mode">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {showModeDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <button type="button" onClick={() => toggleMode('ai')} className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${mode === 'ai' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'} rounded-t-md cursor-pointer`}>
                  <Bot size={20} />
                  <div>
                    <div className="font-medium">AI Discussion</div>
                    <div className="text-xs text-gray-500">Ask questions & get answers</div>
                  </div>
                  {mode === 'ai' && <span className="ml-auto">✓</span>}
                </button>
                <button type="button" onClick={() => toggleMode('notes')} className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${mode === 'notes' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'} rounded-b-md cursor-pointer`}>
                  <FileText size={20} />
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

function MessageBox({ message, handleSaveAsNote }) {
  const { type, content } = message;

  let justify;
  let styles;
  let formatAsMarkdown;
  switch (type) {
    case 'user':
      justify = 'justify-end';
      styles = 'border-2 border-blue-500 bg-blue-600 text-white';
      formatAsMarkdown = false;
      break;
    case 'note':
      justify = 'justify-end';
      styles = 'border-2 border-amber-400 text-gray-800';
      formatAsMarkdown = true;
      break;
    case 'error':
      justify = 'justify-start';
      styles = 'border-2 border-red-700 bg-red-100 text-red-800';
      formatAsMarkdown = false;
      break;
    case 'info':
      justify = 'justify-center items-center';
      styles = 'text-gray-700 italic';
      formatAsMarkdown = false;
      break;
    default:
      justify = 'justify-start';
      styles = 'border-2 border-gray-400';
      formatAsMarkdown = true;
      break;
  }

  let saveAIResponse = null;
  if (type === 'model') {
    saveAIResponse = (
      <button className="mt-2 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors" onClick={handleSaveAsNote}>
        Save as Note
      </button>
    );
  }

  return (
    <div className={`flex ${justify}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${styles} overflow-auto break-words`}>
        <div className={formatAsMarkdown ? 'markdown-body' : ''}>
          {type === 'note' && (
            <div className="text-xs text-amber-600 font-medium mb-1 flex items-center gap-1">
              <FileText size={12} /> Note
            </div>
          )}
          {formatAsMarkdown ? <Markdown content={content} /> : <div>{content}</div>}
        </div>
        {saveAIResponse}
      </div>
    </div>
  );
}
