import React, { useState, useRef, useCallback } from 'react';
import { FileUp } from 'lucide-react';
import inlineLiteMarkdown from './inlineLiteMarkdown';
import { formatFileSize } from '../../../utils/utils';
import { updateInteractionProgress } from './interactionProgressStore';
import InteractionFeedback from './interactionFeedback';

export default function FileInteraction({ id, body, title, courseOps, instructionState, onGraded }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback((files) => {
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
  }, []);

  const handleFileInputChange = useCallback(
    (event) => {
      if (event.target.files) {
        handleFileSelect(event.target.files);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = event.dataTransfer.files;
      if (files) {
        if (fileInputRef.current) {
          const dt = new DataTransfer();
          const existingFiles = Array.from(fileInputRef.current.files);
          const newFiles = Array.from(files).filter((newFile) => !existingFiles.some((existing) => existing.name === newFile.name && existing.size === newFile.size));
          if (newFiles.length > 0) {
            [...existingFiles, ...newFiles].forEach((file) => dt.items.add(file));
            fileInputRef.current.files = dt.files;
            handleFileSelect(dt.files);
          }
        }
      }
    },
    [handleFileSelect],
  );

  const removeFile = useCallback((indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;

    setIsSubmitting(true);
    onGraded?.('pending');

    try {
      const progressFiles = selectedFiles.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        date: file.lastModifiedDate,
      }));

      const totalSize = progressFiles.reduce((total, file) => total + file.size, 0);
      const feedback = `Submission received. Total files: ${progressFiles.length}. Total size: ${formatFileSize(totalSize)}. Thank you!`;
      const details = { type: 'file-submission', files: progressFiles, feedback };

      updateInteractionProgress(id, details);
      await courseOps.addProgress(null, id, 'quizSubmit', 0, details);
      onGraded?.(100);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {inlineLiteMarkdown(body)}
      </div>
      <div id={`drop-zone-${id}`} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <input ref={fileInputRef} type="file" name={`quiz-${id}`} id={`file-input-${id}`} multiple hidden onChange={handleFileInputChange} />
        <label htmlFor={`file-input-${id}`} className="cursor-pointer">
          <div className="text-gray-500">
            <FileUp size={48} className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm">
              <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
            </p>
            {isDragOver && <p className="text-blue-600 font-medium">Drop files here</p>}
          </div>
        </label>

        {selectedFiles.length > 0 && (
          <div className="file-names mt-4 text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">Selected files ({selectedFiles.length}):</p>
            <ul className="space-y-2">
              {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">{file.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{formatFileSize(file.size)}</span>
                  </div>
                  <button type="button" onClick={() => removeFile(index)} className="ml-2 text-gray-400 hover:text-red-500 transition-colors duration-200" aria-label={`Remove ${file.name}`}>
                    x
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button onClick={handleSubmit} type="button" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200" disabled={selectedFiles.length === 0 || isSubmitting}>
        Submit files
      </button>
      {instructionState !== 'exam' && <InteractionFeedback quizId={id} courseOps={courseOps} instructionState={instructionState} />}
    </div>
  );
}
