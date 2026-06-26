import React from 'react';
import { parseDraMarkdown, serializeDraMarkdown, createEmptyDraModel } from '../../../utils/draMarkdown';

// Graphical authoring editor for a Disciplinary Reasoning Assessment. Edits a single
// backing file via the standard topic content helpers; the assessment is defined
// through the form, so no Markdown preview pane is shown.
export default function DraEditor({ courseOps, learningSession }) {
  const [model, setModel] = React.useState(createEmptyDraModel());
  const [dirty, setDirty] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);

  React.useEffect(() => {
    const topic = learningSession?.topic;
    if (!topic || topic.type !== 'dra') {
      return;
    }

    courseOps.getTopic(topic).then((markdown) => {
      setModel(parseDraMarkdown(markdown || ''));
      setDirty(false);
    });
  }, [learningSession?.topic]);

  function updateModel(patch) {
    setModel((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function setMode(which, checked) {
    const next = { practiceMode: model.practiceMode, finalMode: model.finalMode, [which]: checked };
    if (!next.practiceMode && !next.finalMode) {
      return; // at least one mode must remain enabled
    }
    updateModel({ [which]: checked });
  }

  async function commit() {
    if (!dirty || committing) {
      return;
    }

    setCommitting(true);
    try {
      await courseOps.updateTopic(learningSession.topic, serializeDraMarkdown(model));
      setDirty(false);
    } finally {
      setCommitting(false);
    }
  }

  async function discard() {
    const markdown = await courseOps.getTopic(learningSession.topic);
    setModel(parseDraMarkdown(markdown || ''));
    setDirty(false);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="basis-[47px] p-2 flex items-center justify-between border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">
          Editor <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
        </h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
            Discard
          </button>
          <button className="w-[96px] px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs inline-flex items-center justify-center gap-2" onClick={commit} disabled={!dirty || committing}>
            {committing && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            <span>Commit</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full overflow-auto min-w-0 border border-gray-200 rounded p-4">
          <div className="space-y-6 max-w-3xl">
            <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Title</h2>
                <input value={model.title} onChange={(e) => updateModel({ title: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Assessment title" />
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-gray-700">Discipline</h2>
                  <input value={model.discipline} onChange={(e) => updateModel({ discipline: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. Software Engineering" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-gray-700">Problem type</h2>
                  <input value={model.problemType} onChange={(e) => updateModel({ problemType: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="e.g. System modernization" />
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Difficulty: {model.difficulty} / 5</h2>
                <input type="range" min={1} max={5} step={1} value={model.difficulty} onChange={(e) => updateModel({ difficulty: Number(e.target.value) })} className="w-full" />
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Modes</h2>
                <p className="text-xs text-gray-500">Enable practice, final, or both. At least one is required. With both enabled the learner can practice and then choose to enter the final assessment.</p>
                <div className="flex items-center gap-4 text-sm text-gray-700">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={model.practiceMode} onChange={(e) => setMode('practiceMode', e.target.checked)} />
                    Practice
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={model.finalMode} onChange={(e) => setMode('finalMode', e.target.checked)} />
                    Final
                  </label>
                </div>
              </section>

              <section className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={model.instability} onChange={(e) => updateModel({ instability: e.target.checked })} />
                  Enable instability events
                </label>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Learning outcomes</h2>
                <textarea value={model.learningOutcomes} onChange={(e) => updateModel({ learningOutcomes: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" rows={8} placeholder="What the learner should demonstrate. These guide scenario generation when the learner begins." />
              </section>
          </div>
        </div>
      </div>
    </div>
  );
}
