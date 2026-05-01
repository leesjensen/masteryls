import React from 'react';
import { useInteractionProgressStore } from './interactionProgressStore';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import WebPageInteraction from './webPageInteraction';

export default function AiWebPageInteraction({ id, title, body, height, topicPath }) {
  const progress = useInteractionProgressStore(id) || {};
  const value = progress.prompt || '';
  const generatedHtml = progress.html || '';
  const [currentValue, setCurrentValue] = React.useState(value);
  const [sourceOpen, setSourceOpen] = React.useState(false);
  const [sourceValue, setSourceValue] = React.useState(generatedHtml);

  React.useEffect(() => {
    setSourceValue(generatedHtml);
  }, [generatedHtml]);

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>
      <textarea name={`interaction-${id}`} className="w-full h-32 p-3 border bg-white border-gray-300 rounded-lg resize-y transition-colors duration-200 placeholder-gray-400" placeholder="Describe the web page you want to generate ..." defaultValue={value} onChange={(e) => setCurrentValue(e.target.value)}></textarea>
      <button id={`generate-${id}`} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!currentValue.trim()}>
        {generatedHtml ? 'Execute prompt' : 'Generate page'}
      </button>
      {generatedHtml && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="px-4 py-1 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-colors duration-200" onClick={() => setSourceOpen((open) => !open)}>
              {sourceOpen ? 'Hide source' : 'View source'}
            </button>
            {sourceOpen && (
              <button id={`save-source-${id}`} type="button" className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={!sourceValue.trim() || sourceValue === generatedHtml}>
                Apply source
              </button>
            )}
            <button id={`submit-${id}`} type="submit" className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
              Submit
            </button>
          </div>
          {sourceOpen && <textarea className="w-full h-72 p-3 border bg-gray-950 text-gray-100 border-gray-700 rounded-lg resize-y font-mono text-sm leading-5 transition-colors duration-200" data-plugin-masteryls-ai-web-page-source value={sourceValue} spellCheck="false" onChange={(e) => setSourceValue(e.target.value)} />}
          <WebPageInteraction title={title || 'Generated web page'} html={generatedHtml} height={height} topicPath={topicPath} />
        </div>
      )}
    </div>
  );
}
