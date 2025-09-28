import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert';
import rehypeRaw from 'rehype-raw';
import { rehypeMermaid, MermaidBlock } from 'react-markdown-mermaid';
import 'github-markdown-css/github-markdown-light.css';
import '../views/instruction/markdown.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { discussTopic } from '../ai/discussionService';

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
      const response = await discussTopic(apiKey, topicTitle, topicContent, userMessage);
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
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

  const customComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match?.[1];

      if (!inline && language === 'masteryls') {
        // masteryls quiz blocks
        const plugin = languagePlugins.find((p) => p.lang === 'masteryls');
        if (plugin?.processor) {
          const content = String(children).replace(/\n$/, '');
          const pluginJsx = plugin.processor(content);
          return (
            <div
              onClick={(e) => {
                const masteryElement = e.target.closest('[data-plugin-masteryls]');
                if (masteryElement && plugin.handler) {
                  plugin.handler(e, masteryElement);
                }
              }}
            >
              {pluginJsx}
            </div>
          );
        }
        return (
          <pre className={className} {...props}>
            <code>{children}</code>
          </pre>
        );
      }

      // Use SyntaxHighlighter for fenced code blocks with a language
      if (!inline && language) {
        const codeText = String(children).replace(/\n$/, '');
        return (
          <SyntaxHighlighter language={language} style={ghcolors} PreTag="div" {...props}>
            {codeText}
          </SyntaxHighlighter>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Custom link handler
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          {...props}
          onClick={(e) => {
            e.preventDefault();
            if (href?.startsWith('http')) {
              window.open(href, '_blank', 'noopener,noreferrer');
            } else {
              const match = href?.match(/^([^#]*)(#.*)?$/);
              const hrefPath = match?.[1];
              const hrefAnchor = match?.[2];

              if (!hrefPath && hrefAnchor) {
                scrollToAnchor(hrefAnchor, containerRef);
              } else if (hrefPath) {
                const resolvedUrl = new URL(hrefPath, topic.path).toString();
                const targetTopic = course.topicFromPath(resolvedUrl, false);
                if (targetTopic) {
                  courseOps.changeTopic({ ...targetTopic, anchor: hrefAnchor });
                }
              }
            }
          }}
        >
          {children}
        </a>
      );
    },

    // Handle other plugin elements
    div({ node, className, children, ...props }) {
      // Check if this div has plugin attributes
      const pluginMatch = className?.match(/data-plugin-(\w+)/);
      if (pluginMatch) {
        const pluginLang = pluginMatch[1];
        const plugin = languagePlugins.find((p) => p.lang === pluginLang);
        if (plugin?.handler) {
          return (
            <div
              className={className}
              {...props}
              onClick={(e) => {
                const pluginElement = e.target.closest(`[data-plugin-${pluginLang}]`);
                if (pluginElement) {
                  plugin.handler(e, pluginElement);
                }
              }}
            >
              {children}
            </div>
          );
        }
      }
      return (
        <div className={className} {...props}>
          {children}
        </div>
      );
    },
  };

  const components = { ...customComponents, MermaidBlock };

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
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${message.type === 'user' ? 'bg-blue-500 text-white' : message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-800'} overflow-auto break-words`}>
              <div className="whitespace-pre-wrap text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji, remarkGithubBlockquoteAlert]} rehypePlugins={[[rehypeRaw], [rehypeMermaid, { mermaidConfig: { theme: 'default' } }]]} components={components}>
                  {message.content}
                </ReactMarkdown>
              </div>
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
