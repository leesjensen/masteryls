import React from 'react';
import { createUploadDescriptors } from './fileUploadUtils';

const PASTE_HANDLED_FLAG = '__masterylsPasteHandled';

export default function EditorFiles({ courseOps, course, currentTopic, onInsertFiles, externalAddedFiles = [] }) {
  const [files, setFiles] = React.useState([]);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const lastSelectedIndexRef = React.useRef(-1);

  function addFilesToPanelAndUpload(incomingFiles) {
    if (!Array.isArray(incomingFiles) || incomingFiles.length === 0) return;

    const newFiles = createUploadDescriptors(incomingFiles);
    courseOps.addTopicFiles(newFiles);

    setFiles((prevFiles) => {
      const existingNames = new Set(prevFiles.map((f) => f.name));
      const uniqueNewFiles = newFiles.filter((f) => !existingNames.has(f.name));
      return [...prevFiles, ...uniqueNewFiles];
    });

    setSelectedFiles((prevSelected) => {
      const merged = [...prevSelected, ...newFiles.map((file) => file.name)];
      return Array.from(new Set(merged));
    });
  }

  React.useEffect(() => {
    const contentAvailable = !!(currentTopic && currentTopic.path && (!currentTopic.state || currentTopic.state === 'published'));

    if (contentAvailable) {
      async function fetchFiles() {
        setFiles([]);
        if (course && contentAvailable) {
          const data = await courseOps.getTopicFiles();
          if (Array.isArray(data)) {
            const filteredData = data.filter((file) => !currentTopic.path.endsWith(file.name));
            setFiles(filteredData);
          }
        }
      }
      fetchFiles();
    }
  }, [course, currentTopic]);

  function detectTypeFromName(name) {
    if (!name) return 'file';
    const ext = name.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'code';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (['css'].includes(ext)) return 'css';
    return 'file';
  }

  const deleteSelected = () => {
    courseOps.deleteTopicFiles(currentTopic, selectedFiles);
    setFiles((prev) => prev.filter((file) => !selectedFiles.includes(file.name)));
    setSelectedFiles([]);
  };

  const handleItemClick = (e, index, file) => {
    const name = file.name;
    const isSelected = selectedFiles.includes(name);

    if (e.shiftKey && lastSelectedIndexRef.current !== -1) {
      // Range select
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      const rangeNames = files.slice(start, end + 1).map((f) => f.name);
      const newSet = Array.from(new Set([...selectedFiles, ...rangeNames]));
      setSelectedFiles(newSet);
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      if (isSelected) {
        setSelectedFiles((prev) => prev.filter((n) => n !== name));
      } else {
        setSelectedFiles((prev) => [...prev, name]);
      }
      lastSelectedIndexRef.current = index;
    } else {
      // Single select
      if (isSelected) {
        setSelectedFiles([]);
      } else {
        setSelectedFiles([name]);
        lastSelectedIndexRef.current = index;
      }
    }
  };

  const fileSize = (file) => (file && file.size != null ? humanFileSize(file.size) : '');
  function humanFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const thresh = 1024;
    if (Math.abs(bytes) < thresh) return bytes + ' B';
    const units = ['KB', 'MB', 'GB', 'TB'];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
  }

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);

    if (droppedFiles.length > 0) {
      addFilesToPanelAndUpload(droppedFiles);
    }
  };

  React.useEffect(() => {
    if (!Array.isArray(externalAddedFiles) || externalAddedFiles.length === 0) {
      return;
    }

    setFiles((prevFiles) => {
      const existingNames = new Set((prevFiles || []).map((f) => f.name));
      const uniqueNewFiles = externalAddedFiles.filter((f) => f?.name && !existingNames.has(f.name));
      return [...(prevFiles || []), ...uniqueNewFiles];
    });

    setSelectedFiles((prevSelected) => {
      const merged = [...(prevSelected || []), ...externalAddedFiles.map((file) => file.name)];
      return Array.from(new Set(merged));
    });
  }, [externalAddedFiles]);

  React.useEffect(() => {
    const onPaste = (event) => {
      if (event?.[PASTE_HANDLED_FLAG]) {
        return;
      }

      const items = Array.from(event?.clipboardData?.items || []);
      const imageFiles = items
        .filter((item) => item?.kind === 'file' && String(item?.type || '').startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter(Boolean);

      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();
      addFilesToPanelAndUpload(imageFiles);
    };

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [courseOps, currentTopic]);

  return (
    <div className="flex flex-col p-2 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Files</h1>
        <div className="flex items-center">
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" disabled={selectedFiles.length === 0} onClick={() => onInsertFiles(selectedFiles)}>
            Insert
          </button>
          <button className="mx-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" disabled={selectedFiles.length === 0} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      </div>

      <div className={`flex-1 mt-2 p-1 border rounded overflow-auto transition-colors ${isDragOver ? 'border-blue-500 border-2 border-dashed bg-blue-50' : 'border-gray-300'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        {isDragOver && (
          <div className="flex items-center justify-center h-32 text-blue-600 font-medium">
            <div className="text-center">
              <div className="text-2xl mb-2">📁</div>
              <div>Drop files here to add them</div>
            </div>
          </div>
        )}

        {files && files.length > 0 && !isDragOver && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {files.map((file, idx) => {
              const selected = selectedFiles.includes(file.name);
              return (
                <button key={file.name + idx} onClick={(e) => handleItemClick(e, idx, file)} className={`text-left px-1 border rounded shadow-sm flex items-center gap-2 hover:border-blue-400 focus:outline-none ${selected ? 'bg-amber-100 border-amber-400' : 'bg-white'}`}>
                  <input type="checkbox" readOnly checked={selected} className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">{`${detectTypeFromName(file.name)} • ${fileSize(file)}`}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {(!files || files.length === 0) && !isDragOver && (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">📁</div>
              <div>No files yet</div>
              <div className="text-sm">Drag/drop files or paste an image to add it</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
