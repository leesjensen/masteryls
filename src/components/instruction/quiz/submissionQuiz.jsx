import React from 'react';

export default function SubmissionQuiz({ meta }) {
  return (
    <div>
      <div id={`drop-zone-${meta.id}`} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors duration-200">
        <input type="file" name={`quiz-${meta.id}`} id={`file-input-${meta.id}`} multiple hidden />
        <label htmlFor={`file-input-${meta.id}`} className="cursor-pointer">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-sm">
              <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
            </p>
          </div>
        </label>
        <div className="file-names mt-3">
          <p className="text-sm font-medium text-gray-700 mb-1">Selected files:</p>
          <ul className="text-sm text-gray-600"></ul>
        </div>
      </div>
      <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
        Submit
      </button>
    </div>
  );
}
