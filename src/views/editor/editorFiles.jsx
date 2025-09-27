import React from 'react';

export default function EditorFiles({ files, setFiles }) {
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const lastSelectedIndexRef = React.useRef(-1);

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

  return (
    <div className="flex flex-col p-2 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Files</h1>
        <div className="flex items-center">
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" disabled={selectedFiles.length === 0} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      </div>

      <div className="flex-1 mt-2 p-1 border rounded overflow-auto">
        {files && files.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {files.map((file, idx) => {
              const name = file.name;
              const size = fileSize(file);
              const type = detectTypeFromName(name);
              const selected = selectedFiles.includes(name);
              return (
                <button key={name + idx} onClick={(e) => handleItemClick(e, idx, file)} className={`text-left px-1 border rounded shadow-sm flex items-center gap-2 hover:border-blue-400 focus:outline-none ${selected ? 'bg-amber-100 border-amber-400' : 'bg-white'}`}>
                  <input type="checkbox" readOnly checked={selected} className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{name}</div>
                    <div className="text-xs text-gray-500">
                      {type} {size ? `• ${size}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
