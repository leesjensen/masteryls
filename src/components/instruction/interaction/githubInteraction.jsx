import React from 'react';
import { renderLiteMarkdownBlocks } from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';

const GITHUB_URL_PATTERN = /^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+/i;

export default function GithubInteraction({ id, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const existingUrl = progress.url || '';
  const [currentUrl, setCurrentUrl] = React.useState(existingUrl);
  const [isValidUrl, setIsValidUrl] = React.useState(GITHUB_URL_PATTERN.test(existingUrl));

  function handleChange(event) {
    const nextValue = event.target.value;
    setCurrentUrl(nextValue);
    setIsValidUrl(Boolean(nextValue.trim()) && event.target.validity.valid && GITHUB_URL_PATTERN.test(nextValue.trim()));
  }

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {renderLiteMarkdownBlocks(body)}
      </div>
      <input
        type="url"
        name={`quiz-${id}`}
        className="w-full p-3 border bg-white border-gray-300 rounded-lg transition-colors duration-200 placeholder-gray-400"
        value={currentUrl}
        onChange={handleChange}
        placeholder="https://github.com/owner/repo"
      />
      <button id={`submit-${id}`} type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!isValidUrl}>
        Submit Repository
      </button>
    </div>
  );
}
