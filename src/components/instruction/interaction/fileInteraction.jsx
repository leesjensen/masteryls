import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileUp } from 'lucide-react';
import { renderLiteMarkdownBlocks } from './inlineLiteMarkdown';
import { useInteractionProgressStore } from './interactionProgressStore';
import { InteractionSubmitRow } from './InteractionEvaluationStatus.jsx';
import { formatFileSize } from '../../../utils/utils';
import { MAX_FILE_BYTES, IMAGE_BUDGET_BYTES, MAX_FILES_PER_SUBMISSION, ACCEPT_ATTRIBUTE, isAcceptedMime, isImageMime } from '../../../utils/fileSubmissionConstants';
import { compressImageToBudget } from '../../../utils/imageCompression';

export default function FileInteraction({ id, body }) {
  const progress = useInteractionProgressStore(id) || {};
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errors, setErrors] = useState([]);
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);

  const writeFilesToInput = useCallback((files) => {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((file) => dt.items.add(file));
    fileInputRef.current.files = dt.files;
  }, []);

  const intakeFiles = useCallback(
    async (incoming) => {
      const incomingArray = Array.from(incoming || []);
      if (incomingArray.length === 0) return;

      const accepted = [...selectedFiles];
      const nextErrors = [];

      for (const original of incomingArray) {
        if (accepted.length >= MAX_FILES_PER_SUBMISSION) {
          nextErrors.push(`Maximum of ${MAX_FILES_PER_SUBMISSION} files per submission.`);
          break;
        }
        if (!isAcceptedMime(original.type)) {
          nextErrors.push(`${original.name || 'file'}: type "${original.type || 'unknown'}" is not allowed.`);
          continue;
        }
        let file = original;
        if (isImageMime(file.type) && file.size > IMAGE_BUDGET_BYTES) {
          try {
            const compressed = await compressImageToBudget(file, IMAGE_BUDGET_BYTES);
            if (!compressed) {
              nextErrors.push(`${file.name}: could not compress to ${formatFileSize(IMAGE_BUDGET_BYTES)} or less.`);
              continue;
            }
            file = compressed;
          } catch {
            nextErrors.push(`${file.name}: image compression failed.`);
            continue;
          }
        }
        if (file.size > MAX_FILE_BYTES) {
          nextErrors.push(`${file.name}: exceeds ${formatFileSize(MAX_FILE_BYTES)} limit (is ${formatFileSize(file.size)}).`);
          continue;
        }
        const isDup = accepted.some((existing) => existing.name === file.name && existing.size === file.size);
        if (isDup) continue;
        accepted.push(file);
      }

      setSelectedFiles(accepted);
      writeFilesToInput(accepted);
      setErrors(nextErrors);
    },
    [selectedFiles, writeFilesToInput],
  );

  const handleFileInputChange = useCallback(
    (event) => {
      if (event.target.files && event.target.files.length > 0) {
        const incoming = Array.from(event.target.files);
        event.target.value = '';
        intakeFiles(incoming);
      }
    },
    [intakeFiles],
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
      if (event.dataTransfer?.files) {
        intakeFiles(event.dataTransfer.files);
      }
    },
    [intakeFiles],
  );

  const removeFile = useCallback(
    (indexToRemove) => {
      const next = selectedFiles.filter((_, index) => index !== indexToRemove);
      setSelectedFiles(next);
      writeFilesToInput(next);
    },
    [selectedFiles, writeFilesToInput],
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    function handlePaste(event) {
      const items = event.clipboardData?.items;
      if (!items) return;
      const pasted = [];
      for (const item of items) {
        if (item.kind === 'file' && /^image\//.test(item.type)) {
          const file = item.getAsFile();
          if (file) {
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = file.type.split('/')[1] || 'png';
            const named = new File([file], `pasted-${stamp}.${extension}`, { type: file.type, lastModified: Date.now() });
            pasted.push(named);
          }
        }
      }
      if (pasted.length > 0) {
        event.preventDefault();
        intakeFiles(pasted);
      }
    }

    node.addEventListener('paste', handlePaste);
    return () => node.removeEventListener('paste', handlePaste);
  }, [intakeFiles]);

  return (
    <div ref={rootRef} tabIndex={-1} onClick={() => rootRef.current?.focus()}>
      <div className="mb-3 break-words whitespace-pre-line" data-plugin-masteryls-body>
        {renderLiteMarkdownBlocks(body)}
      </div>
      <div id={`drop-zone-${id}`} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <input ref={fileInputRef} type="file" name={`quiz-${id}`} id={`file-input-${id}`} accept={ACCEPT_ATTRIBUTE} multiple required hidden onChange={handleFileInputChange} />
        <label htmlFor={`file-input-${id}`} className="cursor-pointer">
          <div className="text-gray-500">
            <FileUp size={48} className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm">
              <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span>, drag &amp; drop, or paste an image
            </p>
            <p className="mt-1 text-xs text-gray-400">PDF, ZIP, PNG, JPG, WEBP &middot; up to {formatFileSize(MAX_FILE_BYTES)} each &middot; max {MAX_FILES_PER_SUBMISSION} files</p>
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

      {errors.length > 0 && (
        <ul className="mt-2 text-sm text-red-600 list-disc list-inside" role="alert">
          {errors.map((message, idx) => (
            <li key={idx}>{message}</li>
          ))}
        </ul>
      )}

      <InteractionSubmitRow id={id} details={progress} label="Submit files" disabled={selectedFiles.length === 0} />
    </div>
  );
}
