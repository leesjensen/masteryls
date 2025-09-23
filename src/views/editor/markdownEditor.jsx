import React from 'react';
import useLatest from '../../hooks/useLatest';

export default function MarkdownEditor({ courseOps, course, setCourse, currentTopic, changeTopic }) {
  const [content, setContent] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const dirtyRef = useLatest(dirty);

  React.useEffect(() => {
    if (currentTopic?.path) {
      courseOps.getTopic(currentTopic).then((markdown) => {
        setContent(markdown);
        setDirty(false);
      });
    }
    return async () => {
      if (dirtyRef.current) {
        const shouldSave = window.confirm('Do you want to commit your changes?');
        if (shouldSave) {
          commit();
        }
      }
    };
  }, [currentTopic]);

  async function discard() {
    const [updatedCourse, previousTopic, markdown] = await course.discardTopicMarkdown(currentTopic);
    setDirty(false);
    setContent(markdown);
    changeTopic(previousTopic);
    setCourse(updatedCourse);
  }

  async function commit() {
    if (committing) return; // Prevent multiple commits

    setCommitting(true);
    try {
      const updatedTopic = await courseOps.updateTopic(currentTopic, content);
      setDirty(false);
      changeTopic(updatedTopic);
    } catch (error) {
      console.error('Error committing changes:', error);
      alert('Failed to commit changes. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  async function handlePaste(e) {
    // alert('Pasting of files is not yet supported');
    // e.preventDefault();
  }

  return (
    <div className="p-2 flex-9/12 flex flex-col relative">
      {committing && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
          <div className="flex items-center gap-3 text-gray-700">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
            <span className="text-sm font-medium">Committing changes...</span>
          </div>
        </div>
      )}

      <div className="basis-[32px] flex items-center justify-between">
        <h1 className="text-lg font-bold">Markdown</h1>
        <div className="flex items-center">
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
            Discard
          </button>
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
            {committing && <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>}
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
      <pre className="flex-1 flex">
        <textarea
          className="flex-1 text-sm border rounded p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
          value={content}
          wrap="off"
          onChange={(e) => {
            if (committing) return; // Prevent editing during commit
            setContent(e.target.value);
            setDirty(true);
          }}
          onPaste={handlePaste}
          disabled={committing}
        />
      </pre>
    </div>
  );
}

// Handle paste - look for files in clipboard and upload them
// async function handlePaste(e) {
//   alert('Pasting of files is not yet supported');
//   e.preventDefault();
// try {
//   const items = e.clipboardData?.files;
//   if (items && items.length > 0) {
//     e.preventDefault();
//     // Process each file sequentially
//     for (let i = 0; i < items.length; i++) {
//       const file = items[i];
//       // upload
//       //          const uploadedUrl = await uploadFileToGitHub(file);
//       const uploadedUrl = 'https://example.com/uploads/' + file.name; // Mocked URL for example

//       // Insert markdown reference at cursor position
//       const isImage = /^image\//.test(file.type);
//       const markdownLink = isImage ? `![${file.name}](${uploadedUrl})` : `[${file.name}](${uploadedUrl})`;

//       // Insert into textarea value at current cursor position
//       // Use refs to access latest content
//       const textarea = e.target;
//       const start = textarea.selectionStart || 0;
//       const end = textarea.selectionEnd || 0;
//       const newContent = contentRef.current.substring(0, start) + markdownLink + contentRef.current.substring(end);
//       setContent(newContent);
//       setDirty(true);

//       // Move cursor after inserted text
//       requestAnimationFrame(() => {
//         textarea.selectionStart = textarea.selectionEnd = start + markdownLink.length;
//         textarea.focus();
//       });
//     }
//   }
// } catch (err) {
//   console.error(err);
//   window.alert('Failed to upload pasted file: ' + err.message);
// }
//  }
