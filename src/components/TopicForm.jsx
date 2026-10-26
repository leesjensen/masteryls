import React from 'react';
import Button from './ui/Button.jsx';
import Input from './ui/Input.jsx';
import Select from './ui/Select.jsx';
import Textarea from './ui/Textarea.jsx';

// Topic types that submit a score to a Canvas gradebook assignment (see canvasSync.js's
// ASSIGNMENT_TOPIC_TYPES) need a points-possible value; everything else doesn't.
const POINTS_TOPIC_TYPES = ['exam', 'project', 'dra', 'interview'];

function defaultPointsForType(type) {
  return type === 'exam' ? 200 : POINTS_TOPIC_TYPES.includes(type) ? 100 : '';
}

function TopicForm({ topic = { state: 'stub' }, onSubmit, onCancel, isLoading }) {
  const [newTitle, setNewTitle] = React.useState(topic.title || '');
  const [newType, setNewType] = React.useState(topic.type || 'instruction');
  const [newDescription, setNewDescription] = React.useState(topic.description || '');
  const [newPoints, setNewPoints] = React.useState(topic.points ?? defaultPointsForType(topic.type));

  React.useEffect(() => {
    if (POINTS_TOPIC_TYPES.includes(newType)) {
      setNewPoints((prev) => (prev === '' || prev === undefined || prev === null ? defaultPointsForType(newType) : prev));
    } else {
      setNewPoints('');
    }
  }, [newType]);

  const submitButtonText = topic.state === 'stub' ? 'Generate' : 'Save';

  return (
    <div className="mb-0.5 ml-4 p-2 bg-gray-50 border rounded relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-50 bg-opacity-80 flex items-center justify-center rounded z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
            <span className="text-sm">Adding topic...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Input size="sm" type="text" placeholder="Topic title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus disabled={isLoading} />
        <Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value)} disabled={isLoading}>
          <option value="instruction">Instruction</option>
          <option value="embedded">Embedded</option>
          <option value="exam">Exam</option>
          <option value="project">Project</option>
          <option value="dra">Disciplinary Reasoning</option>
          <option value="interview">Interview</option>
        </Select>
        {POINTS_TOPIC_TYPES.includes(newType) && <Input size="sm" type="number" min={0} step={1} value={newPoints} onChange={(e) => setNewPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Points" disabled={isLoading} />}
        <Textarea size="sm" placeholder={newType === 'embedded' ? 'Embedded URL' : 'Description'} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} disabled={isLoading} />
        <div className="flex gap-2">
          <Button size="xs" onClick={() => onSubmit(newTitle, newDescription, newType, newPoints === '' ? undefined : Number(newPoints))} disabled={!newTitle.trim() || isLoading}>
            {isLoading && <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>}
            {isLoading ? 'Adding...' : submitButtonText || 'Add'}
          </Button>
          <Button size="xs" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TopicForm;
