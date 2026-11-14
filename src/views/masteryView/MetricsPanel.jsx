import React from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input.jsx';
import CategoryBarChartSvg from '../../components/charts/categoryBarChartSvg.jsx';
import { handleInAppLinkClick } from '../../utils/linkNavigation.js';
import { rangeForPreset, localInputToIso, formatDurationShort, METRICS_RANGE_PRESETS, DEFAULT_METRICS_RANGE_PRESET } from '../../utils/metricsRange.js';

// Cap the chart so a course with many topics stays legible; the summary still reports the full total.
const TOP_N = 25;

// Progress stores raw topic uuids; course topic ids may carry dashes, so normalize both by stripping
// dashes when mapping id -> title (mirrors the dash-stripping the old metrics view used).
function buildTopicTitleMap(course) {
  const map = new Map();
  for (const topic of course?.allTopics || []) {
    if (topic?.id) map.set(String(topic.id).replace(/-/g, ''), topic.title || 'Untitled topic');
  }
  return map;
}

// The course-scoped Metrics tab. v1 shows topic-view counts over a time range (default last 24h).
// Overseers can filter by section and/or a single learner; a learner sees only their own data
// (the server RPC also enforces that). `scope` is 'overseer' | 'learner'.
export default function MetricsPanel({ courseOps, course, scope = 'overseer', learnerId = null }) {
  const isOverseer = scope === 'overseer';
  const navigate = useNavigate();
  const [preset, setPreset] = React.useState(DEFAULT_METRICS_RANGE_PRESET);
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');
  const [sectionId, setSectionId] = React.useState('');
  const [learnerQuery, setLearnerQuery] = React.useState('');
  const [selectedLearner, setSelectedLearner] = React.useState(null); // { learnerId, learnerName, learnerEmail }
  const [showLearnerList, setShowLearnerList] = React.useState(false);
  const [roster, setRoster] = React.useState([]); // overseer learner list for the type-ahead
  const [result, setResult] = React.useState({ topics: [], total: 0, totalSeconds: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const sections = Array.isArray(course?.sections) ? course.sections : [];
  const topicTitles = React.useMemo(() => buildTopicTitleMap(course), [course]);

  // Overseer: load the full course roster once for the learner type-ahead (independent of any tab).
  React.useEffect(() => {
    if (!isOverseer || !course?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await courseOps.getMasteryOverview({ courseId: course.id });
        if (!cancelled) setRoster(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        /* the type-ahead is a convenience; ignore roster load failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOverseer, course?.id, courseOps]);

  // Resolve the active { startAt, endAt } from the preset (or the custom inputs).
  const range = React.useMemo(() => {
    if (preset !== 'custom') return rangeForPreset(preset);
    return { startAt: localInputToIso(customStart), endAt: localInputToIso(customEnd) };
  }, [preset, customStart, customEnd]);

  // Fetch aggregated topic views whenever the course, range, or filters change.
  React.useEffect(() => {
    if (!course?.id) return undefined;
    // A custom range needs both ends before it is queryable.
    if (preset === 'custom' && (!range.startAt || !range.endAt)) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await courseOps.getTopicViewsEvidence({
          catalogId: course.id,
          startAt: range.startAt,
          endAt: range.endAt,
          sectionId: isOverseer ? sectionId || null : null,
          learnerId: isOverseer ? selectedLearner?.learnerId || null : learnerId || null,
        });
        if (!cancelled) setResult({ topics: Array.isArray(data?.topics) ? data.topics : [], total: Number(data?.total) || 0, totalSeconds: Number(data?.totalSeconds) || 0 });
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Unable to load metrics.');
          setResult({ topics: [], total: 0, totalSeconds: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [course?.id, courseOps, preset, range.startAt, range.endAt, isOverseer, sectionId, selectedLearner?.learnerId, learnerId]);

  // Top N topics by views; active time is shown beside the view count, not as a second scaled bar.
  const chartItems = React.useMemo(
    () =>
      [...result.topics]
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || (Number(b.seconds) || 0) - (Number(a.seconds) || 0))
        .slice(0, TOP_N)
        .map((t) => {
          const title = topicTitles.get(String(t.topicId).replace(/-/g, ''));
          return {
            label: title || 'Unknown topic',
            value: Number(t.count) || 0,
            detail: formatDurationShort(t.seconds),
            href: title && course?.id ? `/course/${course.id}/topic/${t.topicId}` : undefined,
          };
        }),
    [result.topics, topicTitles, course?.id],
  );
  const hiddenTopicCount = Math.max(0, result.topics.length - TOP_N);

  const learnerMatches = React.useMemo(() => {
    const q = learnerQuery.trim().toLowerCase();
    if (!q) return [];
    return roster
      .filter((row) => String(row.learnerName || '').toLowerCase().includes(q) || String(row.learnerEmail || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [roster, learnerQuery]);

  function pickLearner(row) {
    setSelectedLearner(row);
    setLearnerQuery(row.learnerName || row.learnerEmail || '');
    setShowLearnerList(false);
  }

  function clearLearner() {
    setSelectedLearner(null);
    setLearnerQuery('');
    setShowLearnerList(false);
  }

  const presetButton = (p) => (
    <button
      key={p.id}
      type="button"
      onClick={() => setPreset(p.id)}
      className={`rounded-md border px-2.5 py-1 text-sm ${preset === p.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      {p.label}
    </button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="metrics-panel">
      {/* Time range */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Range</span>
        {METRICS_RANGE_PRESETS.map(presetButton)}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-medium">From</span>
            <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Range start" />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-medium">To</span>
            <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Range end" />
          </label>
        </div>
      )}

      {/* Overseer filters: section + learner type-ahead */}
      {isOverseer && (
        <div className="flex flex-wrap items-end gap-4">
          {sections.length > 0 && (
            <div className="flex items-center gap-1">
              <label htmlFor="metrics-section" className="text-sm font-medium text-gray-700">
                Section
              </label>
              <select id="metrics-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Section">
                <option value="">All sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title || 'Section'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative">
            <label htmlFor="metrics-learner" className="mb-1 block text-sm font-medium text-gray-700">
              Learner
            </label>
            <div className="flex items-center gap-1">
              <Input
                id="metrics-learner"
                value={learnerQuery}
                onChange={(e) => {
                  setLearnerQuery(e.target.value);
                  setSelectedLearner(null);
                  setShowLearnerList(true);
                }}
                onFocus={() => setShowLearnerList(true)}
                placeholder="All learners"
                autoComplete="off"
                aria-label="Filter learner"
              />
              {selectedLearner && (
                <button type="button" onClick={clearLearner} className="text-sm text-gray-500 hover:text-gray-700" aria-label="Clear learner filter">
                  ×
                </button>
              )}
            </div>
            {showLearnerList && learnerMatches.length > 0 && !selectedLearner && (
              <ul className="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {learnerMatches.map((row) => (
                  <li key={row.learnerId}>
                    <button type="button" onClick={() => pickLearner(row)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50">
                      <span className="block truncate text-gray-800">{row.learnerName || 'Learner'}</span>
                      <span className="block truncate text-xs text-gray-500">{row.learnerEmail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {/* Chart */}
      <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Topic engagement</h3>
          <span className="text-xs text-gray-500">
            {result.total} view{result.total === 1 ? '' : 's'} · {formatDurationShort(result.totalSeconds)} active
          </span>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : chartItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No topic views in this range.</p>
        ) : (
          <>
            {hiddenTopicCount > 0 && <p className="mb-2 text-xs text-gray-500">Showing the top {TOP_N} of {result.topics.length} topics.</p>}
            <div className="max-h-[60vh] overflow-auto">
              <CategoryBarChartSvg
                items={chartItems}
                color="#3b82f6"
                ariaLabel="Topic views with active time"
                onLabelClick={(item, event) => item.href && handleInAppLinkClick(event, () => navigate(item.href))}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
