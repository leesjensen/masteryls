import React, { useState, useRef, useCallback } from 'react';
import { formatFileSize } from '../../../utils/utils';

export default function FileInteraction({ quizId }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
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

  return (
    <div>
      <div id={`drop-zone-${quizId}`} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <input ref={fileInputRef} type="file" name={`quiz-${quizId}`} id={`file-input-${quizId}`} multiple hidden onChange={handleFileInputChange} />
        <label htmlFor={`file-input-${quizId}`} className="cursor-pointer">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
      <button type="submit" className="mt-3 px-6 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
        Submit files
      </button>
    </div>
  );
}
