import React, { useState, useRef, useEffect } from 'react';
import { StickyNote, MessageCircleOff, X, MessageCircle, Notebook, XCircle } from 'lucide-react';
import { aiDiscussionResponseGenerator } from '../../ai/aiContentGenerator';
import { scrollToBottom } from '../../utils/utils';
import usePersistentAIMessages from '../../hooks/usePersistentAIMessages';
import Tabs from '../Tabs';
import MessageBox from './MessageBox';

export default function DiscussionPanel({ courseOps, learningSession, onClose, noteMessages, setNoteMessages, aiMessages, setAIMessages, discussionContext, setDiscussionContext }) {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const { clearStoredAIMessages } = usePersistentAIMessages(learningSession?.topic?.id, aiMessages, setAIMessages);

  // scroll to the end of the messages and put the focus on the input
  useEffect(() => {
    scrollMessages();
  }, [discussionContext.mode]);

  function scrollMessages() {
    scrollToBottom(messagesContainerRef.current);
    inputRef.current?.focus();
  }

  const modeMessages = discussionContext.mode === 'ai' ? aiMessages : noteMessages;
  const filteredMessages = discussionContext.section ? modeMessages.filter((message) => message.section === discussionContext.section) : modeMessages;

  const handleUserNoteInput = (userMessage) => {
    const notePayload = {
      type: 'note',
      section: discussionContext.section,
      content: userMessage,
      timestamp: Date.now(),
    };
    setNoteMessages((prev) => [...prev, notePayload]);

    // Add a progress record for this note
    const dataToSave = {
      type: 'note',
      section: discussionContext.section,
      content: userMessage,
    };
    courseOps.addProgress(null, null, 'note', 0, dataToSave);
  };

  const handleAIQueryInput = async (userMessage) => {
    const newMessage = { type: 'user', section: discussionContext.section, content: userMessage, timestamp: Date.now() };
    setAIMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);
    scrollMessages();

    let type = 'model';
    let content;
    try {
      content = await aiDiscussionResponseGenerator(discussionContext.topicTitle, discussionContext.topicContent, [...aiMessages, newMessage]);
    } catch (error) {
      type = 'error';
      content = `Sorry, I encountered an error: ${error.message}`;
    } finally {
      const aiMessage = {
        type,
        section: discussionContext.section,
        content,
        timestamp: Date.now(),
      };
      setAIMessages((prev) => [...prev, aiMessage]);

      setIsLoading(false);
      scrollMessages();
    }
  };

  const handleSaveAsNote = (messageIndex) => {
    let messageToSave = filteredMessages[messageIndex];
    messageToSave.state = 'saved';
    if (filteredMessages.length >= 2) {
      const previousMessage = filteredMessages[messageIndex - 1];
      messageToSave = `**Your Question:**\n\n${previousMessage.content}\n\n---\n\n**AI Response:**\n\n${messageToSave.content}`;
    }

    handleUserNoteInput(messageToSave);
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

    if (discussionContext.mode === 'notes') {
      handleUserNoteInput(userMessage);
    } else if (discussionContext.mode === 'ai') {
      handleAIQueryInput(userMessage);
    }
  };

  const toggleMode = (newMode) => {
    setDiscussionContext((prev) => ({ ...prev, mode: newMode }));
    inputRef.current?.focus();
  };

  const clearConversation = () => {
    setAIMessages([]);
    clearStoredAIMessages();
  };

  const modeConfig = {
    ai: {
      placeholder: 'Question...',
      buttonText: 'Discuss',
      emptyStateIcon: MessageCircle,
      emptyStateText: "Ask questions about this topic! I'll help explain concepts and provide additional insights.",
      filterDescriptionPrefix: 'Relevant to',
      filterColor: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    notes: {
      placeholder: 'Note...',
      buttonText: 'Add Note',
      emptyStateIcon: Notebook,
      emptyStateText: 'Take notes about this topic. Your notes will be saved here for future reference.',
      filterDescriptionPrefix: 'Filtered by',
      filterColor: 'bg-amber-50 border-amber-200 text-amber-700',
    },
  }[discussionContext.mode];

  const tabs = [
    { id: 'ai', label: 'Discuss', icon: MessageCircle, visible: true },
    { id: 'notes', label: 'Notes', icon: StickyNote, visible: true },
  ];

  return (
    <div className="h-full bg-white border-l border-gray-300 shadow-lg flex flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between gap-4 pl-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 truncate" title={discussionContext.topicTitle}>
              {discussionContext.topicTitle}
            </h3>
          </div>
          <button className="p-1.5 rounded-sm bg-transparent border border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out cursor-pointer" onClick={onClose} title="Close discussion">
            <X size={16} />
          </button>
        </div>
        <Tabs tabs={tabs} activeTab={discussionContext.mode} onChange={toggleMode} />
        {discussionContext.section && (
          <div className={`m-2 flex items-center gap-2 text-xs border rounded px-2 py-1 ${modeConfig.filterColor}`}>
            <span className={`text-sm flex-1 truncate`}>{`${modeConfig.filterDescriptionPrefix}: ${discussionContext.section}`}</span>
            <button onClick={() => setDiscussionContext((prev) => ({ ...prev, section: null }))} title="Clear filter">
              <XCircle size={14} />
            </button>
          </div>
        )}
      </div>
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-2 flex justify-center">{React.createElement(modeConfig.emptyStateIcon, { size: 48, strokeWidth: 1.5 })}</div>
            <p className="text-sm px-4">{modeConfig.emptyStateText}</p>
          </div>
        )}

        {filteredMessages.map((message, i) => (
          <MessageBox key={message.timestamp} message={message} handleSaveAsNote={() => handleSaveAsNote(i)} setDiscussionContext={setDiscussionContext} />
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
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex space-x-2">
          <textarea
            id="discussion-input"
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
          />
          <div className="relative">
            <div className="flex">
              <button type="submit" disabled={!userInput.trim() || isLoading} className={`px-4 py-2 ${discussionContext.mode === 'ai' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer`}>
                {modeConfig.buttonText}
              </button>
              {discussionContext.mode === 'ai' && (
                <button type="button" disabled={!aiMessages || aiMessages.length === 0} className="p-1.5 rounded-sm bg-transparent border border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" onClick={clearConversation} title="Clear discussion">
                  <MessageCircleOff size={24} />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
