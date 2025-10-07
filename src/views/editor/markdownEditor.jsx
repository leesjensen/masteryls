import React from 'react';
import MonacoMarkdownEditor from '../../components/MonacoMarkdownEditor';

export default function MarkdownEditor({ content, onChange, commit }) {
  const [editorLoaded, setEditorLoaded] = React.useState(false);
  const editorRef = React.useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    setEditorLoaded(true);

    editor.onDidPaste((e) => {
      console.log('Content pasted into the editor', e);
      handlePaste(e);
    });
    // Handle paste of images
    const editorDomNode = editor.getDomNode();
    if (editorDomNode) {
      editorDomNode.addEventListener('paste', handlePaste, true);
    }

    // Add custom key bindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      await commit();
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
    <div className="m-2 flex-9/12 flex flex-col relative border border-gray-300 ">
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
      <div className="flex-1 overflow-hidden">
        <MonacoMarkdownEditor value={content} onChange={onChange} onMount={handleEditorDidMount} theme="vs-light" />
      </div>
    </div>
  );
}

// Handle paste - look for files in clipboard and upload them
async function handlePaste(e) {
  e = e.clipboardEvent;
  if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) return;
  const file = e.clipboardData.files[0];
  if (!/^image\//.test(file.type)) return;

  e.preventDefault();
  try {
    const items = e.clipboardData?.files;
    if (items && items.length > 0) {
      e.preventDefault();
      // Process each file sequentially
      for (let i = 0; i < items.length; i++) {
        const file = items[i];
        // upload
        //          const uploadedUrl = await uploadFileToGitHub(file);
        const uploadedUrl = 'https://example.com/uploads/' + file.name; // Mocked URL for example

        // Insert markdown reference at cursor position
        const markdownLink = `![${file.name}](${uploadedUrl})`;

        insertText(markdownLink);
      }
    }
  } catch (err) {
    console.error(err);
    window.alert('Failed to upload pasted file: ' + err.message);
  }
}
