import React from 'react';
import MonacoMarkdownEditor from '../../components/MonacoMarkdownEditor';
import { aiQuizGenerator, aiSectionGenerator, aiGeneralPromptResponse } from '../../ai/aiContentGenerator';
import InputDialog from '../../hooks/inputDialog';

export default function MarkdownEditor({ currentTopic, content, diffContent, onChange, commit, user }) {
  const [editorLoaded, setEditorLoaded] = React.useState(false);
  const editorRef = React.useRef(null);
  const subjectDialogRef = React.useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editor.setPosition({ lineNumber: 1, column: 1 });
    editor.focus();
    editorRef.current = editor;

    setEditorLoaded(true);

    // Save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      await commit();
    });

    // Find and Replace
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find').run();
    });

    // Find and Replace
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.startFindReplaceAction').run();
    });

    // Multi-cursor select next occurrence
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

  const insertQuiz = (quizTemplate) => {
    const quizWithUuid = quizTemplate.replace(/"id":""/, `"id":"${crypto.randomUUID()}"`);
    insertText(quizWithUuid);
  };

  const prefixInsertText = (text) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      let position = selection.getStartPosition();
      editorRef.current.setPosition({ lineNumber: position.lineNumber, column: 1 });
      insertText(text);
    }
  };

  const wrapSelection = (before, after, selectionRequired = false) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current.getModel().getValueInRange(selection);
      let newText = before;
      if (selectedText) {
        newText = before + selectedText + after;
      } else if (selectionRequired) {
        return;
      }

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

  const insertAiSection = async () => {
    const subject = await subjectDialogRef.current.show({
      title: 'Generate section',
      description: 'What would you like the section to be about?',
      placeholder: 'subject',
      confirmButtonText: 'Generate',
      required: true,
    });

    if (subject) {
      const topic = currentTopic.description || currentTopic.title;
      const apiKey = user.getSetting('geminiApiKey');
      const response = '\n' + (await aiSectionGenerator(apiKey, topic, subject)) + '\n';
      insertText(response);
    }
  };

  const insertAiQuiz = async () => {
    const subject = await subjectDialogRef.current.show({
      title: 'Generate quiz',
      description: 'What would you like the quiz to be about?',
      placeholder: 'subject',
      confirmButtonText: 'Generate',
      required: true,
    });

    if (subject) {
      const topic = currentTopic.description || currentTopic.title;
      const apiKey = user.getSetting('geminiApiKey');
      let response = '\n' + (await aiQuizGenerator(apiKey, topic, subject)) + '\n';

      insertText(response.replace(/"id":"[^"]*"/, `"id":"${crypto.randomUUID()}"`));
    }
  };

  const insertPromptContent = async () => {
    const subject = await subjectDialogRef.current.show({
      title: 'Generate content',
      description: 'What would you like to generate?',
      placeholder: 'generation prompt',
      confirmButtonText: 'Generate',
      required: true,
    });

    if (subject) {
      const topic = currentTopic.description || currentTopic.title;
      const apiKey = user.getSetting('geminiApiKey');
      const response = '\n' + (await aiGeneralPromptResponse(apiKey, topic, subject)) + '\n';
      insertText(response);
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
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => prefixInsertText('## ')} title="Heading 2">
            H2
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => prefixInsertText('### ')} title="Heading 3">
            H3
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText(defaultTableTemplate)} title="Table">
            ⊞
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => prefixInsertText('- ')} title="Bullet List">
            •
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => prefixInsertText('1. ')} title="Numbered List">
            1.
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => wrapSelection('[', '](url)', true)} title="Link">
            🔗
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertText('![alt text](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80)')} title="Image">
            🖼️
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertQuiz(defaultMultipleChoiceQuizTemplate)} title="Multiple Choice Quiz">
            ◉
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertQuiz(defaultMultipleSelectQuizTemplate)} title="Multiple Select Quiz">
            ☑
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertQuiz(defaultEssayQuizTemplate)} title="Essay Quiz">
            📝
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertQuiz(defaultFileSubmissionQuizTemplate)} title="File Submission Quiz">
            ⬆️
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertQuiz(defaultUrlSubmissionQuizTemplate)} title="URL Submission Quiz">
            🌐
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertAiQuiz()} title="Insert AI generated quiz">
            🚀
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertAiSection()} title="Insert AI generated section">
            ✨
          </button>
          <button className="px-2 py-1 hover:bg-gray-200 rounded text-xs" onClick={() => insertPromptContent()} title="Insert AI prompt response">
            💡
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
        <MonacoMarkdownEditor content={content} diffContent={diffContent} compareValue={'fish tacos'} onChange={onChange} onMount={handleEditorDidMount} theme="vs-light" />
      </div>

      <InputDialog dialogRef={subjectDialogRef} />
    </div>
  );
}

const defaultTableTemplate = `\n
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1 Col 1 | Row 1 Col 2 | Row 1 Col 3 |
| Row 2 Col 1 | Row 2 Col 2 | Row 2 Col 3 |\n
`;

const defaultMultipleSelectQuizTemplate = `
\`\`\`masteryls
{"id":"", "title":"Multiple select", "type":"multiple-select", "body": "A **multiple select** question can have multiple answers. Incorrect selections count against correct ones when calculating the correct percentage." }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This is **not** the right answer
- [x] Another right answer
- [ ] This is **not** the right answer
\`\`\`
`;

const defaultMultipleChoiceQuizTemplate = `
\`\`\`masteryls
{"id":"", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;
const defaultEssayQuizTemplate = `
\`\`\`masteryls
{"id":"", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
\`\`\`
`;

const defaultFileSubmissionQuizTemplate = `
\`\`\`masteryls
{"id":"", "title":"File submission", "type":"file-submission", "body":"Simple **submission** by file", "allowComment":true  }
\`\`\`
`;

const defaultUrlSubmissionQuizTemplate = `
\`\`\`masteryls
{"id":"", "title":"URL submission", "type":"url-submission", "body":"Simple **submission** by url", "allowComment":true }
\`\`\`
`;

// // Handle paste - look for files in clipboard and upload them
// async function handlePaste(e) {
//   e = e.clipboardEvent;
//   if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) return;
//   const file = e.clipboardData.files[0];
//   if (!/^image\//.test(file.type)) return;

//   e.preventDefault();
//   try {
//     const items = e.clipboardData?.files;
//     if (items && items.length > 0) {
//       e.preventDefault();
//       // Process each file sequentially
//       for (let i = 0; i < items.length; i++) {
//         const file = items[i];
//         // upload
//         //          const uploadedUrl = await uploadFileToGitHub(file);
//         const uploadedUrl = 'https://example.com/uploads/' + file.name; // Mocked URL for example

//         // Insert markdown reference at cursor position
//         const markdownLink = `![${file.name}](${uploadedUrl})`;

//         insertText(markdownLink);
//       }
//     }
//   } catch (err) {
//     console.error(err);
//     window.alert('Failed to upload pasted file: ' + err.message);
//   }
// }
