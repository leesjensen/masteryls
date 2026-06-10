import React from 'react';
import { LONG_RUNNING_TASK_MESSAGES } from '../../../utils/loadingMessages.js';

export function InteractionSubmitRow({ id, details, label = 'Submit', loadingLabel = 'Evaluating', disabled = false, buttonClassName = '', buttonProps = {}, children, className = '' }) {
  const isLoading = details?.evaluationState === 'loading';
  const { className: buttonPropsClassName = '', disabled: buttonPropsDisabled = false, children: _ignoredChildren, id: _ignoredId, ...restButtonProps } = buttonProps;

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`.trim()}>
      <button id={`submit-${id}`} type="submit" className={`w-[150px] px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200 ${buttonClassName} ${buttonPropsClassName}`.trim()} disabled={isLoading || disabled || buttonPropsDisabled} {...restButtonProps}>
        {isLoading ? loadingLabel : label}
      </button>
      {children}
      <InteractionEvaluationStatus details={details} />
    </div>
  );
}

function InteractionEvaluationStatus({ details }) {
  const isLoading = details?.evaluationState === 'loading';
  const [messageIndex, setMessageIndex] = React.useState(0);

  React.useEffect(() => {
    setMessageIndex(Math.floor(Math.random() * LONG_RUNNING_TASK_MESSAGES.length));
    if (!isLoading) return;

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % LONG_RUNNING_TASK_MESSAGES.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isLoading, details?.evaluationStartedAt]);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-blue-900" role="status" aria-live="polite">
      <div className="font-medium">{` ...${LONG_RUNNING_TASK_MESSAGES[messageIndex].toLowerCase()}`}</div>
    </div>
  );
}
