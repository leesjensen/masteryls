import React, { useState, useRef, useEffect } from 'react';
import { aiDiscussionResponseGenerator } from '../ai/aiContentGenerator';
import Markdown from './Markdown';

export default function DiscussionPanel({ courseOps, learningSession, isOpen, onClose, topicTitle, topicContent, user, activeSection = null }) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('ai');  // 'ai' or 'notes'
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

  useEffect(() => {
    // Reset messages when selected section changes
    // TODO: The saved messages should be fetched from the backend only when the parent text interaction is first loaded.
    // There should be some sort of visual cue on the text interaction if there are existing notes.
    // TODO: If the user closes the text interaction and re-opens it, or switches back and forth between sections, the AI discussion history should persist.
    (async () => {
      const notes = (await courseOps.getProgress({
        topicId: learningSession.topic.id,
        enrollmentId: learningSession.enrollment.id,
        types: ['note'],
        limit: 100,
      })).data;
      // TODO: Handle if there are more than 100 notes
      const pIsRelevant = (p) => {
        if (!p.details) return false;
        if (
          (mode === 'notes' && p.details.type !== 'note')
          || (mode === 'ai' && p.details.type === 'note')
        ) {
          return false;
        }
        if (activeSection === null) {
          return p.details.activeSection === null;
        }
        return p.details.activeSection?.sectionId === activeSection.sectionId;
      }
      setMessages(notes.filter(pIsRelevant)
        .map(p => {
          const details = p.details;
          details.timestamp = new Date(p.createdAt);
          return details;
        })
        .sort((a, b) => a.timestamp - b.timestamp));
    })();
  }, [activeSection, learningSession.topic.id, learningSession.enrollment.id, courseOps, mode]);

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

  const handleUserNoteInput = (userMessage, addToVisibleMessages = true) => {
    if (addToVisibleMessages) {
      const notePayload = {
        type: 'note',
        activeSection,
        content: userMessage,
        timestamp: Date.now(),
      };
      setMessages((prev) => [
        ...prev,
        notePayload,
      ]);
    }

    // Save to progress table in backend
    const dataToSave = {
      type: 'note',
      activeSection,
      content: userMessage
    };
    courseOps.addProgress(null, null, 'note', 0, dataToSave);
  };

  const handleAIQueryInput = async (userMessage) => {
    const newMessages = [...messages, { type: 'user', activeSection, content: userMessage, timestamp: Date.now() }];
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
          activeSection,
          content,
          timestamp: Date.now(),
        },
      ]);

      setIsLoading(false);
    }
  };

  const handleSaveAsNote = (messageIndex, includePreviousMessage = true) => {
    // Save both the most recent message (AI response) and optionally the previous user message (query) as a note
    // If including the previous message, concatenate both into one note
    if (messageIndex <= 0 || messageIndex >= messages.length) return;
    const messageToSave = messages[messageIndex];
    let contentToSave;
    if (includePreviousMessage && messages.length >= 2) {
      const previousMessage = messages[messageIndex - 1];
      contentToSave = `**Your Question:**\n\n${previousMessage.content}\n\n---\n\n**AI Response:**\n\n${messageToSave.content}`;
    } else {
      contentToSave = messageToSave.content;
    }

    // Save it now exactly as if it was a user note, but don't add to visible messages
    handleUserNoteInput(contentToSave, false);

    // Create a visual confirmation in the messages panel
    setMessages((prev) => [
      ...prev,
      {
        type: 'info',
        activeSection,
        content: 'This AI response has been saved as a note.',
        timestamp: Date.now(),
      },
    ]);
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
  }[mode];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-lg bg-white border-l border-gray-300 shadow-lg z-50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 truncate" title={fullTopicTitle}>
              Notebook - {fullTopicTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => toggleMode('ai')}
                className={`px-3 py-1.5 rounded-md font-medium text-sm transition-all ${mode === 'ai'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                🤖 AI
              </button>
              <button
                onClick={() => toggleMode('notes')}
                className={`px-3 py-1.5 rounded-md font-medium text-sm transition-all ${mode === 'notes'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                📝 Notes
              </button>
            </div>
            <button className="w-3 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={clearConversation} title="Clear discussion">
              🔄
            </button>
            <button className="w-3 m-0.5 p-0.5 text-xs font-medium rounded-sm bg-transparent border border-transparent filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out" onClick={onClose} title="Close discussion">
              ❌
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="mb-2 text-2xl">{modeConfig.emptyStateIcon}</p>
            <p className="text-sm px-4">
              {modeConfig.emptyStateText}
            </p>
          </div>
        )}

        {messages.map((message, i) =>
          <MessageBox key={message.timestamp} message={message} handleSaveAsNote={() => handleSaveAsNote(i)} />
        )}

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
              <button
                type="submit"
                disabled={!userInput.trim() || isLoading}
                className={`px-4 py-2 ${mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                {modeConfig.buttonText}
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


function MessageBox({ message, handleSaveAsNote }) {
  const { type, content } = message;

  let justify;
  let styles;
  switch (type) {
    case 'user':
      justify = 'justify-end';
      styles = 'border-2 border-blue-500 bg-blue-600 text-white';
      break;
    case 'note':
      justify = 'justify-end';
      styles = 'border-2 border-amber-400 text-gray-800';
      break;
    case 'error':
      justify = 'justify-start';
      styles = 'border-2 border-red-700 bg-red-100 text-red-800';
      break;
    case 'info':
      justify = 'justify-center items-center';
      styles = 'text-gray-700 italic';
      break;
    default:
      justify = 'justify-start';
      styles = 'border-2 border-gray-400';
  }
  const formatAsMarkdown = type !== 'user';

  let saveAIResponse = null;
  if (type === 'model') {
    saveAIResponse = (
      <button
        className="mt-2 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
        onClick={handleSaveAsNote}
      >
        Save as Note
      </button>
    );
  }

  return (
    <div className={`flex ${justify}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${styles} overflow-auto break-words`}>
        {formatAsMarkdown ? (
          <div className="markdown-body">
            {type === 'note' && (
              <div className="text-xs text-amber-600 font-medium mb-1">📝 Note</div>
            )}
            <Markdown content={content} />
          </div>
        ) : (
          <div>
            {content}
          </div>
        )}
        {saveAIResponse}
      </div>
    </div>
  );
}
