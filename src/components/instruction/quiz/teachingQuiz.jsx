import React, { useEffect, useRef, useState } from 'react';
import { aiTeachingResponseGenerator } from '../../../ai/aiContentGenerator';
import Markdown from '../../Markdown';
import { updateQuizProgress, useQuizProgressStore } from './quizProgressStore';

export default function TeachingQuiz({ quizId, topicTitle, question }) {
  const progress = useQuizProgressStore(quizId) || {};
  const initialQuestion = progress.messages || (question ? [{ type: 'model', content: question, timestamp: Date.now() }] : []);
  const [messages, setMessages] = useState(initialQuestion);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Keep local state in sync if progress store updates elsewhere.
  useEffect(() => {
    if (progress.messages && progress.messages !== messages) {
      setMessages(progress.messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.messages]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const persistMessages = (messages) => {
    updateQuizProgress(quizId, {
      ...progress,
      type: 'teachingQuiz',
      messages,
      lastUpdated: Date.now(),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = userInput.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { type: 'user', content: trimmed, timestamp: Date.now() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setUserInput('');
    setIsLoading(true);

    let message;
    try {
      const aiResponse = await aiTeachingResponseGenerator(topicTitle, '', nextMessages);
      message = { type: 'model', content: aiResponse, timestamp: Date.now() };
    } catch (error) {
      message = {
        type: 'error',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: Date.now(),
      };
    } finally {
      if (message) {
        const updated = [...nextMessages, message];
        setMessages(updated);
        persistMessages(updated);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <div ref={listRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && <div className="text-center text-gray-500 text-sm py-6">Start teaching by asking a question.</div>}

        {messages.map((message) => (
          <div key={message.timestamp} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg border text-sm break-words whitespace-pre-wrap ${message.type === 'user' ? 'bg-blue-600 text-white border-blue-600' : message.type === 'error' ? 'border-red-600 text-red-700 bg-red-50' : 'border-gray-300 bg-white text-gray-800'}`}>
              {message.type === 'model' ? (
                <div className="markdown-body">
                  <Markdown content={message.content} />
                </div>
              ) : (
                <span>{message.content}</span>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-sm">Thinking…</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 px-4 py-3 flex gap-2">
        <input ref={inputRef} type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="As a teacher, respond to the learner ..." className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isLoading} />
        <button type="submit" disabled={!userInput.trim() || isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          Send
        </button>
      </form>
    </div>
  );
}
