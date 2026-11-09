import React from 'react';
import { Activity, LoaderCircle } from 'lucide-react';
import { aiPulseGenerator } from '../../ai/aiContentGenerator';
import Markdown from '../../components/Markdown.jsx';
import MarkdownEditor from '../../components/editor/markdownEditor.jsx';
import Splitter from '../../components/Splitter.jsx';
import useSplitPaneState from '../../hooks/useSplitPaneState.jsx';
import Button from '../../components/ui/Button.jsx';
import { normalizePulseMarkdown } from '../../utils/pulseMarkdown.js';
import { resolveLearnerPulseTermId } from '../../utils/pulseTerm.js';
import { buildPulseRosterEvidence, excludePulseStaffRows } from '../../utils/pulseEvidence.js';
import { buildPulseTrendHistory, COURSE_LEARNER_COHORT_MARKER } from '../../utils/pulseTrend.js';

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

export default function PulseArchive({ courseOps, course, targetType, targetId, targetName, enrollmentId = null, learnerRow = null, evidence, rosterRows = [], sections = [], canEdit, canGenerate = true, canGenerateFeedback = false, extraControls = null }) {
  const [terms, setTerms] = React.useState([]);
  const [termId, setTermId] = React.useState('');
  const [pulses, setPulses] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [markdown, setMarkdown] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [progressMessage, setProgressMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const { panePercent, splitContainerRef, onPaneMoved, onPaneResized } = useSplitPaneState(50, { minPercent: 25, maxPercent: 75 });
  const service = courseOps.service;
  const user = courseOps.user;

  // A learner pulse is scoped to the learner's enrollment term (resolved from their section), so the
  // learner/observer view locks to that term and shows no chooser; '' means the enrollment has no
  // term, in which case the view shows nothing.
  const lockedLearnerTermId = React.useMemo(() => resolveLearnerPulseTermId(learnerRow, course.sections), [learnerRow?.sectionId, course.sections]);

  React.useEffect(() => {
    let alive = true;
    service.getCourseTerms(course.id).then((rows) => {
      if (alive) setTerms(rows);
    }).catch((e) => setError(e.message));
    return () => { alive = false; };
  }, [service, course.id]);

  // Pick the active term: a learner target locks to its enrollment term (or none); course/section
  // targets default to the current term (or the latest) and keep the chooser.
  React.useEffect(() => {
    if (targetType === 'learner') {
      setTermId(lockedLearnerTermId && terms.some((term) => term.id === lockedLearnerTermId) ? lockedLearnerTermId : '');
      return;
    }
    if (!terms.length) return;
    const current = terms.find((term) => term.startDate && term.endDate && new Date(term.startDate) <= new Date() && new Date(term.endDate) >= new Date());
    setTermId((prev) => prev || current?.id || terms.at(-1)?.id || '');
  }, [targetType, lockedLearnerTermId, terms]);

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
    setBusy(true); setError(''); setProgressMessage('Preparing pulse…');
    try {
      const previousPulse = pulses[0]?.markdown || '';
      const pulseTrendHistory = buildPulseTrendHistory(pulses, 8, { requireCourseLearnerCohort: targetType !== 'learner' });
      let currentEvidence = evidence;
      if (targetType === 'learner' && learnerRow) {
        currentEvidence = await courseOps.collectLearnerAnalysisEvidence(learnerRow, course, { onProgress: setProgressMessage });
      } else if (targetType !== 'learner') {
        setProgressMessage('Checking course staff roles…');
        const staffUserIds = await service.getCoursePulseExcludedUserIds(course.id);
        const filteredRoster = excludePulseStaffRows(rosterRows, staffUserIds);
        const pulseRosterRows = filteredRoster.rows;
        currentEvidence = {
          ...buildPulseRosterEvidence(pulseRosterRows, { sections, schedules: course.schedules || [] }),
          excludedCourseStaffCount: filteredRoster.excludedCount,
        };
        if (courseOps.collectCourseSectionPulseEvidence) {
          const selectedSections = targetType === 'section' ? sections.filter((section) => String(section.id) === String(targetId)) : sections;
          const detailedEvidence = await courseOps.collectCourseSectionPulseEvidence({ rows: pulseRosterRows, course, term: terms.find((term) => term.id === termId), sections: selectedSections, sectionId: targetType === 'section' ? targetId : null, onProgress: setProgressMessage });
          currentEvidence = { ...currentEvidence, ...detailedEvidence };
        }
      }
      setProgressMessage('Taking pulse…');
      const body = await aiPulseGenerator({ targetType, targetName, term: terms.find((term) => term.id === termId), currentEvidence, previousPulse, pulseTrendHistory });
      const pulseMarkdown = normalizePulseMarkdown(body);
      const cohortSafeMarkdown = targetType === 'learner' ? pulseMarkdown : `${pulseMarkdown.trimEnd()}\n\n${COURSE_LEARNER_COHORT_MARKER}\n`;
      setProgressMessage('Saving pulse…');
      const pulse = await service.createPulse({ catalogId: course.id, termId, targetType, targetId, enrollmentId, markdown: cohortSafeMarkdown, createdBy: user.id });
      setProgressMessage('Refreshing pulse history…');
      await load(); setSelected(pulse);
    } catch (e) { setError(e.message || 'Unable to generate pulse.'); }
    finally { setBusy(false); setProgressMessage(''); }
  }

  async function generateFeedback() {
    if (!termId || !learnerRow || !canGenerateFeedback) return;
    setBusy(true); setError(''); setProgressMessage('Preparing learner feedback…');
    try {
      const result = await courseOps.generateLearnerFeedback(learnerRow, course, { onProgress: setProgressMessage });
      const subject = String(result?.subject || `Your progress in ${course?.title || 'the course'}`).replace(/\s+/g, ' ').trim().slice(0, 200);
      const body = String(result?.body || '').trim();
      if (!body) throw new Error('The feedback generator returned an empty message. Please try again.');
      const feedbackMarkdown = normalizePulseMarkdown(`# ${subject}\n\n${body}`);
      setProgressMessage('Saving feedback pulse…');
      const pulse = await service.createPulse({ catalogId: course.id, termId, targetType: 'learner', targetId, enrollmentId, pulseType: 'feedback', markdown: feedbackMarkdown, createdBy: user.id });
      setProgressMessage('Refreshing pulse history…');
      await load(); setSelected(pulse);
    } catch (e) { setError(e.message || 'Unable to generate feedback.'); }
    finally { setBusy(false); setProgressMessage(''); }
  }

  async function save() {
    setBusy(true); setError(''); setProgressMessage('Saving pulse changes…');
    try {
      const updated = await service.updatePulse(selected.id, markdown);
      setPulses((rows) => rows.map((pulse) => pulse.id === updated.id ? updated : pulse));
      setSelected(updated);
      setEditing(false);
    }
    catch (e) { setError(e.message); }
    finally { setBusy(false); setProgressMessage(''); }
  }

  const topic = { title: `${targetName} Pulse`, type: 'instruction', path: 'pulse.md' };

  const termTitle = terms.find((term) => term.id === termId)?.title || '';

  return <div className="flex min-w-0 flex-col gap-3" data-testid="pulse-archive">
    {/* Course/section targets keep the term chooser + generate control up top; a learner target has
        no chooser — its term is fixed by the enrollment and shown in the sidebar with its actions. */}
    {targetType !== 'learner' && <div className="flex flex-wrap items-end gap-3">
      {extraControls}
      <label className="text-sm">Term<select aria-label="Pulse term" className="ml-2 rounded border border-gray-300 p-1" value={termId} onChange={(e) => { setTermId(e.target.value); setSelected(null); }}><option value="">Select term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.title}</option>)}</select></label>
      {canGenerate && <Button size="sm" disabled={!termId || busy} onClick={generate}>Take pulse</Button>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!termId && targetType !== 'learner' && <p className="text-sm text-gray-500">Create a term before generating a pulse.</p>}
    {termId && <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col">
          <div className="mb-2 border-b border-gray-100 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">{targetType === 'learner' ? 'Pulse History' : `${targetType === 'section' ? 'Section' : 'Course'} Pulse`}</h2>
            <p className="truncate text-xs text-gray-500">{targetName}</p>
            {targetType === 'learner' && <>
              {termTitle && <p className="mt-1 text-xs text-gray-500">Term: <span className="font-medium text-gray-700">{termTitle}</span></p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {canGenerate && <Button size="xs" disabled={busy} onClick={generate}>Take pulse</Button>}
                {canGenerateFeedback && <Button size="xs" variant="outline" disabled={busy} onClick={generateFeedback}>Feedback</Button>}
              </div>
            </>}
          </div>
          <nav aria-label="Pulse history" className="max-h-72 min-h-0 flex-1 space-y-0.5 overflow-auto lg:max-h-[70vh]">
            {pulses.map((pulse) => <button key={pulse.id} type="button" onClick={() => setSelected(pulse)} className={`block w-full rounded px-2 py-1.5 text-left text-sm ${selected?.id === pulse.id ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50'}`}>
              <span className="flex items-center gap-1.5">
                <Activity size={14} aria-hidden="true" className="shrink-0 text-blue-600" />
                <span>Pulse {pulse.pulseNumber}{pulse.pulseType === 'feedback' && <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Feedback</span>}</span>
              </span>
              <span className="mt-0.5 block pl-[1.375rem] text-xs text-gray-500">{formatDate(pulse.createdAt)}</span>
            </button>)}
            {!pulses.length && <p className="text-sm text-gray-500">No pulses for this term yet.</p>}
          </nav>
        </div>
        <div className="relative min-w-0 lg:border-l lg:border-gray-200 lg:pl-4">
          {/* The generation signifier overlays the content area (like the Markdown editor's AI
              overlay) so it marks where the pulse will appear without shifting the layout. */}
          {busy && <div role="status" aria-live="polite" className="absolute inset-0 z-20 rounded bg-white bg-opacity-90">
            {/* Sticky so the signifier rides the top of the viewport instead of being centered far
                down a long, overlaid pulse where it can't be seen. */}
            <div className="sticky top-0 flex items-center justify-center gap-3 border-b border-gray-100 bg-white/70 p-5 text-gray-700">
              <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-sm font-medium">{progressMessage || 'Taking pulse…'}</span>
            </div>
          </div>}
          {selected ? <>
            <div className="mb-2 flex justify-end gap-2">{canEdit && !editing && <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Edit</Button>}{editing && <><Button size="xs" variant="secondary" onClick={() => { setMarkdown(normalizePulseMarkdown(selected.markdown)); setEditing(false); }}>Cancel</Button><Button size="xs" disabled={busy} onClick={save}>Save changes</Button></>}</div>
            {editing ? <div ref={splitContainerRef} className="flex h-[70vh] min-h-[32rem] min-w-0 overflow-hidden rounded border border-gray-200">
              <div className="flex h-full min-h-0 min-w-0 shrink-0 overflow-hidden" style={{ width: `${panePercent}%` }}><MarkdownEditor course={course} currentTopic={topic} content={markdown} committedContent={selected.markdown} onChange={setMarkdown} commit={() => {}} showToolbar={false} /></div>
              <Splitter onMove={onPaneMoved} onResized={onPaneResized} />
              <div className="h-full min-h-0 min-w-0 flex-1 overflow-auto bg-white"><div className="markdown-body mx-auto min-h-full max-w-[880px] p-4"><Markdown learningSession={{ course, topic }} content={markdown} /></div></div>
            </div> : <article className="markdown-body max-w-none"><Markdown learningSession={{ course, topic }} content={normalizePulseMarkdown(selected.markdown)} /></article>}
          </> : busy ? <div className="min-h-[16rem]" aria-hidden="true" /> : null}
        </div>
      </div>
    </section>}
  </div>;
}
