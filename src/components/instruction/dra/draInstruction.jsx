import React from 'react';
import Markdown from '../../Markdown';
import { parseDraMarkdown } from '../../../utils/draMarkdown';

// Read-only learner shell for a Disciplinary Reasoning Assessment. This is a display
// shell only; the interactive investigation (stakeholder chat, reasoning record,
// evaluation) is a later phase.
export default function DraInstruction({ courseOps, learningSession, content = null, instructionState = 'learning' }) {
  const [markdown, setMarkdown] = React.useState(content || '');

  React.useEffect(() => {
    if (content != null) {
      setMarkdown(content);
      return;
    }

    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'dra') {
      return;
    }

    courseOps.getTopic(topic).then((md) => setMarkdown(md || ''));
  }, [content, learningSession?.topic]);

  const model = React.useMemo(() => parseDraMarkdown(markdown), [markdown]);

  const metadata = [
    { label: 'Discipline', value: model.discipline || 'Unspecified' },
    { label: 'Problem type', value: model.problemType || 'Unspecified' },
    { label: 'Difficulty', value: `${model.difficulty} / 5` },
    { label: 'Mode', value: model.mode === 'final' ? 'Final' : 'Practice' },
    { label: 'Instability', value: model.instability ? 'On' : 'Off' },
  ];

  return (
    <div className="h-full w-full min-h-0 min-w-0 overflow-auto">
      <div className="markdown-body p-4 max-w-3xl mx-auto">
        <h1>{model.title || 'Disciplinary Reasoning Assessment'}</h1>

        <div className="not-prose flex flex-wrap gap-2 my-3">
          {metadata.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <span className="font-semibold">{item.label}:</span>
              <span>{item.value}</span>
            </span>
          ))}
        </div>

        <h2>Scenario</h2>
        {model.scenarioTitle && <h3>{model.scenarioTitle}</h3>}
        <Markdown learningSession={learningSession} content={model.scenarioGoal || '_Scenario goal to be defined._'} />
      </div>
    </div>
  );
}
