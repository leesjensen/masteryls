import React, { useState } from 'react';

export default function NewModuleButton({ course, setCourse, user, service }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const updatedCourse = course.constructor._copy(course);
    updatedCourse.modules.push({
      title: title.trim(),
      topics: [],
    });
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    try {
      const token = user.gitHubToken(course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `add module '${title.trim()}'`);
      }
    } catch (err) {
      console.error('Failed to persist new module:', err);
    }
    setTitle('');
    setShowForm(false);
    setSaving(false);
  };

  if (!showForm) {
    return (
      <button className="text-gray-400 hover:text-amber-600 text-sm py-1" onClick={() => setShowForm(true)}>
        + Add New Module
      </button>
    );
  }
  return (
    <div className="mt-4 flex items-center gap-2">
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="px-2 py-1 border rounded text-sm" placeholder="Module title" autoFocus disabled={saving} />
      <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs" onClick={handleCreate} disabled={!title.trim() || saving}>
        Create
      </button>
      <button className="px-2 py-1 bg-gray-400 text-white rounded text-xs" onClick={() => setShowForm(false)} disabled={saving}>
        Cancel
      </button>
    </div>
  );
}
