import React from 'react';
import MonacoMarkdownEditor from '../../components/MonacoMarkdownEditor';
import { aiQuizGenerator, aiSectionGenerator, aiGeneralPromptResponse } from '../../ai/aiContentGenerator';
import InputDialog from '../../hooks/inputDialog';

const MarkdownEditor = React.forwardRef(function MarkdownEditor({ course, currentTopic, content, diffContent, onChange, commit }, ref) {
  const [editorLoaded, setEditorLoaded] = React.useState(false);
  const editorRef = React.useRef(null);
  const subjectDialogRef = React.useRef(null);

  // Expose insertText and insertFiles functions to parent via ref
  React.useImperativeHandle(
    ref,
    () => ({
      insertText,
      insertFiles,
    }),
    [],
  );

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

  // Function to insert files as appropriate markdown
  const insertFiles = (files) => {
    if (!files || files.length === 0) return;

    const markdownLinks = files
      .map((file) => {
        const fileExtension = file.split('.').pop().toLowerCase();

        // Generate appropriate markdown based on file type
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExtension)) {
          // Image files
          return `![${file}](${file})`;
        } else if (['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension)) {
          // Video files
          return `<video controls width="100%">\n  <source src="${file}" type="video/${fileExtension === 'mov' ? 'quicktime' : fileExtension}">\n  Your browser does not support the video tag.\n</video>`;
        } else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) {
          // Audio files
          return `<audio controls>\n  <source src="${file}" type="audio/${fileExtension}">\n  Your browser does not support the audio tag.\n</audio>`;
        } else {
          // Other files (documents, code, etc.)
          return `[${file}](${file})`;
        }
      })
      .join('\n\n');

    insertText(markdownLinks);
  };

  const insertQuiz = (quizTemplate) => {
    const quizWithUuid = quizTemplate.replace(/"id":""/, `"id":"${crypto.randomUUID()}"`);
    insertText(quizWithUuid);
  };

  const insertLink = () => {
    if (!course || !Array.isArray(course.allTopics) || course.allTopics.length === 0) {
      window.alert('No topics available to link.');
      return;
    }

    const topics = course.allTopics;
    const list = topics.map((t, i) => `${i + 1}. ${t.title || t.description || t.path || '(untitled)'}`).join('\n');

    const choice = window.prompt(`Select a topic to insert (enter number):\n\n${list}`);
    if (!choice) return;

    const index = parseInt(choice, 10) - 1;
    if (!Number.isFinite(index) || index < 0 || index >= topics.length) return;

    const topic = topics[index];
    const markdown = `[${topic.title}](/course/${course.id}/topic/${topic.id})`;

    insertText(markdown);
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
      const response = '\n' + (await aiSectionGenerator(topic, subject)) + '\n';
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
      let response = '\n' + (await aiQuizGenerator(topic, subject)) + '\n';
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
      const response = '\n' + (await aiGeneralPromptResponse(topic, subject)) + '\n';
      insertText(response);
    }
  };

  return (
    <div className="m-2 flex-9/12 flex flex-col relative border border-gray-300 ">
      {/* Markdown Toolbar */}
      {editorLoaded && (
        <div className="basis-[36px] flex items-center gap-1 px-2 py-1 bg-gray-50 border-b text-sm">
          <ToolbarButton onClick={() => wrapSelection('**', '**')} title="Bold (Ctrl+B)" text="B" />
          <ToolbarButton onClick={() => wrapSelection('*', '*')} title="Italic (Ctrl+I)" text="I" />
          <ToolbarButton onClick={() => wrapSelection('`', '`')} title="Inline Code" text="</>" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <ToolbarButton onClick={() => prefixInsertText('## ')} title="Heading 2" text="H2" />
          <ToolbarButton onClick={() => prefixInsertText('### ')} title="Heading 3" text="H3" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <ToolbarButton onClick={() => insertText(defaultTableTemplate)} title="Table" text="⊞" />
          <ToolbarButton onClick={() => prefixInsertText('- ')} title="Bullet List" text="•" />
          <ToolbarButton onClick={() => prefixInsertText('1. ')} title="Numbered List" text="1." />
          <ToolbarButton onClick={() => insertLink()} title="Link" text="🔗" />
          <ToolbarButton onClick={() => insertText('![alt text](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=100&q=80)')} title="Image" text="🖼️" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <ToolbarButton onClick={() => insertQuiz(defaultMultipleChoiceInteractionTemplate)} title="Multiple Choice Quiz" text="◉" />
          <ToolbarButton onClick={() => insertQuiz(defaultMultipleSelectQuizTemplate)} title="Multiple Select Quiz" text="☑" />
          <ToolbarButton onClick={() => insertQuiz(defaultEssayInteractionTemplate)} title="Essay Quiz" text="📝" />
          <ToolbarButton onClick={() => insertQuiz(defaultFileInteractionTemplate)} title="File Submission Quiz" text="⬆️" />
          <ToolbarButton onClick={() => insertQuiz(defaultUrlInteractionTemplate)} title="URL Submission Quiz" text="🌐" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <ToolbarButton onClick={() => insertAiQuiz()} title="Insert AI generated quiz" text="🚀" />
          <ToolbarButton onClick={() => insertAiSection()} title="Insert AI generated section" text="✨" />
          <ToolbarButton onClick={() => insertPromptContent()} title="Insert AI prompt response" text="💡" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <ToolbarButton onClick={() => editorRef.current.getAction('actions.find').run()} title="Find (Ctrl+F)" text="🔍" />
          <ToolbarButton onClick={() => editorRef.current.getAction('editor.action.startFindReplaceAction').run()} title="Find & Replace (Ctrl+Shift+F)" text="🔄" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <MonacoMarkdownEditor content={content} diffContent={diffContent} onChange={onChange} onMount={handleEditorDidMount} theme="vs-light" />
      </div>

      <InputDialog dialogRef={subjectDialogRef} />
    </div>
  );
});

export default MarkdownEditor;

function ToolbarButton({ onClick, title, text }) {
  return (
    <button className="px-2 py-1 rounded text-xs grayscale hover:bg-gray-200 hover:grayscale-0 hover:text-amber-600" onClick={onClick} title={title}>
      {text}
    </button>
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

const defaultMultipleChoiceInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;
const defaultEssayInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"Essay", "type":"essay", "body":"Simple **essay** question" }
\`\`\`
`;

const defaultFileInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"File submission", "type":"file-submission", "body":"Simple **submission** by file", "allowComment":true  }
\`\`\`
`;

const defaultUrlInteractionTemplate = `
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
