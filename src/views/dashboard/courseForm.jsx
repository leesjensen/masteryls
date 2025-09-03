import React, { useState } from 'react';

export default function CourseForm({ onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    // For now just log — parent can be updated to accept created course data
    console.log('Create course', { title, description });
    if (onClose) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-top justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Create a Course</h2>
          <p className="text-sm text-gray-500 mt-1">Add a title and short description for your new course.</p>
        </div>

        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input id="course-title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. Intro to React" />
          </div>

          <div>
            <label htmlFor="course-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea id="course-description" name="description" required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-y" placeholder="Short summary of what learners will accomplish" />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
              Cancel
            </button>

            <button type="submit" className="px-4 py-2 rounded-md bg-amber-400 hover:bg-amber-500 text-white font-semibold text-sm shadow">
              Create Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
