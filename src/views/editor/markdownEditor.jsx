import React from 'react';
import MonacoMarkdownEditor from '../../components/MonacoMarkdownEditor';
import useLatest from '../../hooks/useLatest';

export default function MarkdownEditor({ courseOps, setCourse, currentTopic }) {
  const [content, setContent] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [editorLoaded, setEditorLoaded] = React.useState(false);
  const editorRef = React.useRef(null);
  const dirtyRef = useLatest(dirty);

  React.useEffect(() => {
    if (currentTopic && currentTopic.path) {
      courseOps.getTopicMarkdown(currentTopic).then((markdown) => {
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
    const [updatedCourse, previousTopic, markdown] = await courseOps.discardTopicMarkdown(currentTopic);
    setDirty(false);
    setContent(markdown);
    courseOps.changeTopic(previousTopic);
    setCourse(updatedCourse);
  }

  async function commit() {
    if (committing) return; // Prevent multiple commits

    setCommitting(true);
    try {
      const updatedTopic = await courseOps.updateTopic(currentTopic, content);
      setDirty(false);
      courseOps.changeTopic(updatedTopic);
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

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    setEditorLoaded(true);

    // Add custom key bindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (dirty && !committing) {
        commit();
      }
    });

    // Add Find and Replace shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find').run();
    });

    // Add Find and Replace All shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.startFindReplaceAction').run();
    });

    // Add Multi-cursor shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.getAction('editor.action.addSelectionToNextFindMatch').run();
    });
  }

  function handleEditorChange(value) {
    if (committing) return;
    setContent(value || '');
    setDirty(true);
  }

  // Helper functions for editor actions
  const insertText = (text) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      editorRef.current.executeEdits('', [
        {
          range: selection,
          text: text,
          forceMoveMarkers: true,
        },
      ]);
      editorRef.current.focus();
    }
  };

  const wrapSelection = (before, after) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current.getModel().getValueInRange(selection);
      const newText = before + selectedText + after;

      editorRef.current.executeEdits('', [
        {
          range: selection,
          text: newText,
          forceMoveMarkers: true,
        },
      ]);
      editorRef.current.focus();
    }
  };

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

      {/* Markdown Toolbar */}
      {editorLoaded && (
        <div className="basis-[36px] flex items-center gap-1 px-2 py-1 bg-gray-50 border-b text-sm">
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs font-bold" onClick={() => wrapSelection('**', '**')} title="Bold (Ctrl+B)">
            B
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs italic" onClick={() => wrapSelection('*', '*')} title="Italic (Ctrl+I)">
            I
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => wrapSelection('`', '`')} title="Inline Code">
            {'</>'}
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('# ')} title="Heading 1">
            H1
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('## ')} title="Heading 2">
            H2
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('### ')} title="Heading 3">
            H3
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('- ')} title="Bullet List">
            •
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('1. ')} title="Numbered List">
            1.
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => wrapSelection('[', '](url)')} title="Link">
            🔗
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('![alt text](image-url)')} title="Image">
            🖼️
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            className="px-2 py-1 hover:bg-gray-200 rounded text-xs"
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.getAction('actions.find').run();
              }
            }}
            title="Find (Ctrl+F)"
          >
            🔍
          </button>
          <button
            className="px-2 py-1 hover:bg-gray-200 rounded text-xs"
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.getAction('editor.action.startFindReplaceAction').run();
              }
            }}
            title="Find & Replace (Ctrl+Shift+F)"
          >
            🔄
          </button>
        </div>
      )}
      <div className="flex-1 border rounded overflow-hidden">
        <MonacoMarkdownEditor value={content} onChange={handleEditorChange} onMount={handleEditorDidMount} readOnly={committing} theme="vs-light" />
      </div>
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
