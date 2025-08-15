import React from 'react';

export default function EditorFiles({ course, currentTopic }) {
  const [files, setFiles] = React.useState(['image1.png', 'image2.png', 'reallfdsflllfdsfldslfldfds.fdsafdsafsdaf.jpg', 'main.js', 'App.jsx', 'index.html', 'styles.css', 'README.md']);

  const [selectedFiles, setSelectedFiles] = React.useState([]);

  const handleSelect = (e) => {
    const options = Array.from(e.target.options);
    const selected = options.filter((option) => option.selected).map((option) => option.value);
    setSelectedFiles(selected);
  };

  const deleteSelected = () => {
    setFiles(files.filter((file) => !selectedFiles.includes(file)));
    setSelectedFiles([]);
  };

  return (
    <div className="p-2 flex-3/12 shrink-0 basis-[64px] flex flex-col">
      <div className="basis-[32px] flex items-center justify-between">
        <h1 className="text-lg font-bold">Files</h1>
        <div className="flex items-center">
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" disabled={selectedFiles.length === 0} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      </div>
      <select id="topic-files" className="flex-1 mt-2 p-2 border rounded" size={5} multiple value={selectedFiles} onChange={handleSelect}>
        {files.map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
    </div>
  );
}
