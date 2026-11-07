import React from 'react';
import { aiPulseGenerator } from '../../ai/aiContentGenerator';
import Markdown from '../../components/Markdown.jsx';
import MarkdownEditor from '../../components/editor/markdownEditor.jsx';
import Splitter from '../../components/Splitter.jsx';
import useSplitPaneState from '../../hooks/useSplitPaneState.jsx';
import Button from '../../components/ui/Button.jsx';

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function normalizePulseMarkdown(content) {
  return String(content || '').replace(/^> .*?\|\s*Snapshot date:\s*(\d{4}-\d{2}-\d{2})\s*$/m, '**Snapshot date:** $1');
}

export default function PulseArchive({ courseOps, course, targetType, targetId, targetName, enrollmentId = null, learnerRow = null, evidence, canEdit, extraControls = null }) {
  const [terms, setTerms] = React.useState([]);
  const [termId, setTermId] = React.useState('');
  const [pulses, setPulses] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [markdown, setMarkdown] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const { panePercent, splitContainerRef, onPaneMoved, onPaneResized } = useSplitPaneState(50, { minPercent: 25, maxPercent: 75 });
  const service = courseOps.service;
  const user = courseOps.user;

  React.useEffect(() => {
    let alive = true;
    service.getCourseTerms(course.id).then((rows) => {
      if (!alive) return;
      setTerms(rows);
      const current = rows.find((term) => term.startDate && term.endDate && new Date(term.startDate) <= new Date() && new Date(term.endDate) >= new Date());
      setTermId(current?.id || rows.at(-1)?.id || '');
    }).catch((e) => setError(e.message));
    return () => { alive = false; };
  }, [service, course.id]);

  const load = React.useCallback(async () => {
    if (!termId) return;
    try {
      const rows = await service.getPulses(course.id, termId, targetType, targetId);
      setPulses(rows);
      if (!selected || !rows.some((row) => row.id === selected.id)) setSelected(rows[0] || null);
    } catch (e) { setError(e.message); }
  }, [course.id, service, termId, targetType, targetId]);
  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => { setMarkdown(normalizePulseMarkdown(selected?.markdown)); setEditing(false); }, [selected?.id, selected?.markdown]);

  async function generate() {
    if (!termId) return;
    setBusy(true); setError('');
    try {
      const previousPulse = pulses[0]?.markdown || '';
      const currentEvidence = targetType === 'learner' && learnerRow
        ? await courseOps.collectLearnerAnalysisEvidence(learnerRow, course)
        : evidence;
      const body = await aiPulseGenerator({ targetType, targetName, term: terms.find((term) => term.id === termId), currentEvidence, previousPulse });
      const pulse = await service.createPulse({ catalogId: course.id, termId, targetType, targetId, enrollmentId, markdown: String(body || ''), createdBy: user.id });
      await load(); setSelected(pulse);
    } catch (e) { setError(e.message || 'Unable to generate pulse.'); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setError('');
    try {
      const updated = await service.updatePulse(selected.id, markdown);
      setPulses((rows) => rows.map((pulse) => pulse.id === updated.id ? updated : pulse));
      setSelected(updated);
      setEditing(false);
    }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const topic = { title: `${targetName} Pulse`, type: 'instruction', path: 'pulse.md' };

  return <div className="flex min-w-0 flex-col gap-3" data-testid="pulse-archive">
    <div className="flex flex-wrap items-end gap-3">
      {extraControls}
      <label className="text-sm">Term<select aria-label="Pulse term" className="ml-2 rounded border border-gray-300 p-1" value={termId} onChange={(e) => { setTermId(e.target.value); setSelected(null); }}><option value="">Select term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.title}</option>)}</select></label>
      <Button size="sm" disabled={!termId || busy} onClick={generate}>{busy ? 'Taking pulse…' : 'Take pulse'}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!termId && <p className="text-sm text-gray-500">Create a term before generating a pulse.</p>}
    {termId && <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
      <div><h2 className="text-lg font-semibold">{targetType === 'learner' ? 'Learner Pulse History' : `${targetType === 'section' ? 'Section' : 'Course'} Pulse`}</h2><p className="text-sm text-gray-500">{targetName}</p></div>
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <nav aria-label="Pulse history" className="max-h-72 space-y-1 overflow-auto">
            {pulses.map((pulse) => <button key={pulse.id} type="button" onClick={() => setSelected(pulse)} className={`block w-full rounded p-2 text-left text-sm ${selected?.pulseNumber === pulse.pulseNumber ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50'}`}>Pulse {pulse.pulseNumber}<span className="block text-xs text-gray-500">{formatDate(pulse.createdAt)}</span></button>)}
            {!pulses.length && <p className="text-sm text-gray-500">No pulses for this term yet.</p>}
          </nav>
        </div>
        <div className="min-w-0">
          {selected && <>
            <div className="mb-2 flex justify-end gap-2">{canEdit && !editing && <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Edit</Button>}{editing && <><Button size="xs" variant="secondary" onClick={() => { setMarkdown(normalizePulseMarkdown(selected.markdown)); setEditing(false); }}>Cancel</Button><Button size="xs" disabled={busy} onClick={save}>Save changes</Button></>}</div>
            {editing ? <div ref={splitContainerRef} className="flex h-[70vh] min-h-[32rem] min-w-0 overflow-hidden rounded border border-gray-200">
              <div className="flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden" style={{ width: `${panePercent}%` }}><MarkdownEditor course={course} currentTopic={topic} content={markdown} committedContent={selected.markdown} onChange={setMarkdown} commit={() => {}} showToolbar={false} /></div>
              <Splitter onMove={onPaneMoved} onResized={onPaneResized} />
              <div className="h-full min-h-0 min-w-0 flex-1 overflow-auto bg-white"><div className="markdown-body mx-auto min-h-full max-w-[880px] p-4"><Markdown learningSession={{ course, topic }} content={markdown} /></div></div>
            </div> : <article className="markdown-body max-w-none"><Markdown learningSession={{ course, topic }} content={normalizePulseMarkdown(selected.markdown)} /></article>}
          </>}
        </div>
      </div>
    </section>}
  </div>;
}
