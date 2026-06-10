import React from 'react';
import { renderLiteMarkdownBlocks } from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';
import { InteractionSubmitRow } from './InteractionEvaluationStatus.jsx';

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
      <input type="url" name={`quiz-${id}`} className="w-full p-3 border bg-white border-gray-300 rounded-lg transition-colors duration-200 placeholder-gray-400" value={currentUrl} onChange={handleChange} placeholder="https://github.com/owner/repo" />
      <InteractionSubmitRow id={id} details={progress} disabled={!isValidUrl} />
    </div>
  );
}
