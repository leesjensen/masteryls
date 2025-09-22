import React from 'react';
import useLatest from '../../hooks/useLatest';

export default function MarkdownEditor({ service, user, course, setCourse, currentTopic, changeTopic }) {
  const [content, setContent] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const dirtyRef = useLatest(dirty);
  const contentRef = useLatest(content);
  const courseRef = useLatest(course);

  React.useEffect(() => {
    if (currentTopic?.path) {
      course.loadTopicMarkdown(currentTopic).then((markdown) => {
        setContent(markdown);
        setDirty(false);
      });
    }
    return async () => {
      if (dirtyRef.current) {
        const shouldSave = window.confirm('Do you want to stage your changes?');
        if (shouldSave) {
          const [updatedCourse] = await courseRef.current.saveTopicMarkdown(currentTopic, contentRef.current);
          setCourse(updatedCourse);
        }
      }
    };
  }, [currentTopic]);

  async function stage(content) {
    const [updatedCourse, savedTopic] = await course.saveTopicMarkdown(currentTopic, content);
    setDirty(false);
    setCourse(updatedCourse);
    changeTopic(savedTopic);
  }

  async function discard() {
    const [updatedCourse, previousTopic, markdown] = await course.discardTopicMarkdown(currentTopic);
    setDirty(false);
    setContent(markdown);
    changeTopic(previousTopic);
    setCourse(updatedCourse);
  }

  async function commit() {
    const [updatedCourse, committedTopic] = await course.updateTopicMarkdown(user, service, currentTopic);
    setDirty(false);
    changeTopic(committedTopic);
    setCourse(updatedCourse);
  }

  async function handlePaste(e) {
    // alert('Pasting of files is not yet supported');
    // e.preventDefault();
  }

  return (
    <div className="p-2 flex-9/12 flex flex-col">
      <div className="basis-[32px] flex items-center justify-between">
        <h1 className="text-lg font-bold">Markdown</h1>
        <span className="text-xs text-gray-500">{currentTopic?.lastUpdated && `Modified: ${new Date(currentTopic.lastUpdated).toLocaleString()}`}</span>
        <div className="flex items-center">
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={() => stage(content)} disabled={!dirty}>
            Stage
          </button>
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!currentTopic?.lastUpdated}>
            Discard
          </button>
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={commit} disabled={dirty || !currentTopic?.lastUpdated}>
            Commit
          </button>
        </div>
      </div>
      <pre className="flex-1 flex">
        <textarea
          className="flex-1 text-sm border rounded p-2"
          value={content}
          wrap="off"
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          onPaste={handlePaste}
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
