import React from 'react';
import { Activity, X } from 'lucide-react';
import Button from './ui/Button.jsx';

// A slim, dismissible reminder bar (not a modal) shown at the top of the classroom when a learner is
// due to take their own pulse. See usePulsePromptReminder for the gating.
export default function PulseReminderBanner({ onTake, onDismiss }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
      <Activity size={16} aria-hidden="true" className="shrink-0 text-blue-600" />
      <span className="min-w-0 flex-1">It's been a while — would you like to take your pulse to see how you're doing?</span>
      <Button size="xs" onClick={onTake}>Take pulse</Button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss reminder" className="rounded p-1 text-blue-600 hover:bg-blue-100">
        <X size={16} />
      </button>
    </div>
  );
}
