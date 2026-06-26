import React from 'react';

// Formative coaching panel (practice only). Shows the coach agent's feedback, hints,
// and suggested next investigations on demand.
export default function DraCoach({ coaching, onRequest, busy, readOnly }) {
  const hints = coaching?.hints || [];
  const suggestions = coaching?.suggestions || [];

  return (
    <div className="not-prose mt-8">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-lg font-bold text-gray-800">Coaching</h2>
        <button onClick={onRequest} disabled={readOnly || busy} className="px-4 py-2 bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-60 text-sm">
          {busy ? 'Coaching...' : coaching ? 'Get new coaching' : 'Get coaching'}
        </button>
      </div>

      {coaching && (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3">
          {coaching.feedback && <p className="text-sm text-gray-800">{coaching.feedback}</p>}
          {hints.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Hints</div>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Try next</div>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
