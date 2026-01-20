import React, { useEffect, useRef, useState } from 'react';
import { aiTeachingResponseGenerator } from '../../../ai/aiContentGenerator';
import Markdown from '../../Markdown';
import { updateInteractionProgress, useInteractionProgressStore } from './interactionProgressStore';

export default function TeachingInteraction({ id, topicTitle, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const initialQuestion = progress.messages || (body ? [{ type: 'model', content: body, timestamp: Date.now() }] : []);
  const [messages, setMessages] = useState(initialQuestion);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (progress.messages && progress.messages !== messages) {
      setMessages(progress.messages);
    }
  }, [progress.messages]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const persistMessages = (messages) => {
    updateInteractionProgress(id, {
      ...progress,
      type: 'TeachingInteraction',
      messages,
      lastUpdated: Date.now(),
    });
  };

  const handleClear = () => {
    const cleared = messages.slice(0, 1);
    setMessages(cleared);
    persistMessages(cleared);
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

  const parseResponseMessage = (content) => {
    const scoreMatch = content.match(/^(.*?)Understanding Score:\s*(\d+)%/s);
    const text = scoreMatch ? scoreMatch[1].trim() : content;
    const score = scoreMatch ? parseInt(scoreMatch[2], 10) : 0;
    return (
      <div>
        <div className="markdown-body">
          <Markdown content={text} />
        </div>
        <div className="mt-2 text-sm text-gray-400 text-right">Understanding: {score}%</div>
      </div>
    );
  };

  return (
    <div>
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <div ref={listRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && <div className="text-center text-gray-500 text-sm py-6">In this interaction, you are teacher trying to help a learner.</div>}

          {messages.map((message) => (
            <div key={message.timestamp} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-lg border text-sm break-words whitespace-pre-wrap ${message.type === 'user' ? 'bg-blue-50 text-blue-700 border-blue-600' : message.type === 'error' ? 'border-red-600 text-red-700 bg-red-50' : 'border-gray-300 bg-white text-gray-800'}`}>{message.type === 'model' ? parseResponseMessage(message.content) : <span>{message.content}</span>}</div>
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
          <button type="submit" disabled={!userInput.trim() || isLoading} className="px-4 py-2 bg-white border-1 border-gray-400 text-gray-800 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
            ▶ Respond
          </button>
        </form>
      </div>
      <div className="flex gap-2 mt-4">
        <button id="submit-session" score="30" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          Submit session
        </button>
        <button onClick={handleClear} type="button" className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 disabled:opacity-50">
          Clear
        </button>
      </div>
    </div>
  );
}
