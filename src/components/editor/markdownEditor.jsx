import React from 'react';
import { Bold, Italic, Code, Heading2, Heading3, Table, List, ListOrdered, Link, Image, CircleDot, SquareX, BookOpenCheck, FileUp, CloudUpload, ListChecks, TextSelect, Bot, WrapText } from 'lucide-react';
import MonacoMarkdownEditor from '../../components/MonacoMarkdownEditor';
import { aiQuizGenerator, aiSectionGenerator, aiGeneralPromptResponse } from '../../ai/aiContentGenerator';
import InputDialog from '../../hooks/inputDialog';

const defaultImagePlaceholderUrl = 'https://images.unsplash.com/photo-1767597186218-813e8e6c44d6?q=80&w=400';

const MarkdownEditor = React.forwardRef(function MarkdownEditor({ course, currentTopic, content, diffContent, onChange, commit, onEditorReady }, ref) {
  const [editorOptions, setEditorOptions] = React.useState({ wordWrap: 'on', lineNumbers: 'on' });
  const [editorLoaded, setEditorLoaded] = React.useState(false);
  const editorRef = React.useRef(null);
  const subjectDialogRef = React.useRef(null);

  React.useEffect(() => {
    const savedOptions = localStorage.getItem('markdownEditorOptions');
    if (savedOptions) {
      setEditorOptions(JSON.parse(savedOptions));
    }
  }, []);

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
    const textEditor = editor?.getModifiedEditor ? editor.getModifiedEditor() : editor;
    if (!textEditor) return;

    textEditor.setPosition({ lineNumber: 1, column: 1 });
    textEditor.focus();
    editorRef.current = textEditor;
    onEditorReady?.(textEditor);

    setEditorLoaded(true);

    // Save
    textEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      await commit();
    });

    // Find and Replace
    textEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      textEditor.getAction('actions.find').run();
    });

    // Find and Replace
    textEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      textEditor.getAction('editor.action.startFindReplaceAction').run();
    });

    // Multi-cursor select next occurrence
    textEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      textEditor.getAction('editor.action.addSelectionToNextFindMatch').run();
    });
  }

  React.useEffect(() => {
    return () => onEditorReady?.(null);
  }, []);

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

  const toggleWordWrap = () => {
    const nextWordWrap = editorOptions.wordWrap === 'off' ? 'on' : 'off';
    saveEditorOptions({ ...editorOptions, wordWrap: nextWordWrap });
  };

  const toggleLineNumbers = () => {
    const nextLineNumbers = editorOptions.lineNumbers === 'off' ? 'on' : 'off';
    saveEditorOptions({ ...editorOptions, lineNumbers: nextLineNumbers });
  };

  const saveEditorOptions = (options) => {
    localStorage.setItem('markdownEditorOptions', JSON.stringify(options));
    setEditorOptions(options);
  };

  const getToggleColor = (state) => (state === 'on' ? 'text-amber-600' : 'text-gray-500');
  const getToggleText = (state) => (state === 'on' ? 'On' : 'Off');

  return (
    <div className="flex-1 min-w-0 flex flex-col relative border border-gray-300">
      {/* Markdown Toolbar */}
      {editorLoaded && (
        <div className="basis-[36px] flex items-center gap-1 px-2 py-1 bg-gray-50 border-b-2 border-gray-300 text-sm overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-1 border border-gray-200 rounded bg-white p-1">
            <EditorButton icon={WrapText} className={getToggleColor(editorOptions.wordWrap)} onClick={toggleWordWrap} title={`Word Wrap: ${getToggleText(editorOptions.wordWrap)}`} />
            <EditorButton icon={ListOrdered} className={getToggleColor(editorOptions.lineNumbers)} onClick={toggleLineNumbers} title={`Line Numbers: ${getToggleText(editorOptions.lineNumbers)}`} />
          </div>
          <span className="rounded-md bg-blue-50 border border-blue-500 text-blue-500 px-1 text-xs">Format</span>
          <EditorButton icon={Bold} onClick={() => wrapSelection('**', '**')} title="Bold (Ctrl+B)" />
          <EditorButton icon={Italic} onClick={() => wrapSelection('*', '*')} title="Italic (Ctrl+I)" />
          <EditorButton icon={Code} onClick={() => wrapSelection('`', '`')} title="Inline Code" />
          <EditorButton icon={Heading2} onClick={() => prefixInsertText('## ')} title="Heading 2" />
          <EditorButton icon={Heading3} onClick={() => prefixInsertText('### ')} title="Heading 3" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <span className="rounded-md bg-blue-50 border border-blue-500 text-blue-500 px-1 text-xs">Content</span>
          <EditorButton icon={Table} onClick={() => insertText(defaultTableTemplate)} title="Table" />
          <EditorButton icon={List} onClick={() => prefixInsertText('- ')} title="Bullet List" />
          <EditorButton icon={Link} onClick={() => insertLink()} title="Link" />
          <EditorButton icon={Image} onClick={() => insertText(`![alt text](${defaultImagePlaceholderUrl})`)} title="Image" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <span className="rounded-md bg-blue-50 border border-blue-500 text-blue-500 px-1 text-xs">Quiz</span>
          <EditorButton icon={CircleDot} onClick={() => insertQuiz(defaultMultipleChoiceInteractionTemplate)} title="Multiple Choice Quiz" />
          <EditorButton icon={SquareX} onClick={() => insertQuiz(defaultMultipleSelectQuizTemplate)} title="Multiple Select Quiz" />
          <EditorButton icon={BookOpenCheck} onClick={() => insertQuiz(defaultEssayInteractionTemplate)} title="Essay Quiz" />
          <EditorButton icon={FileUp} onClick={() => insertQuiz(defaultFileInteractionTemplate)} title="File Submission Quiz" />
          <EditorButton icon={CloudUpload} onClick={() => insertQuiz(defaultUrlInteractionTemplate)} title="URL Submission Quiz" />
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <span className="rounded-md bg-blue-50 border border-blue-500 text-blue-500 px-1 text-xs">AI</span>
          <EditorButton icon={ListChecks} onClick={() => insertAiQuiz()} title="AI generated quiz" />
          <EditorButton icon={TextSelect} onClick={() => insertAiSection()} title="AI generated section" />
          <EditorButton icon={Bot} onClick={() => insertPromptContent()} title="AI prompt response" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <MonacoMarkdownEditor content={content} diffContent={diffContent} onChange={onChange} onMount={handleEditorDidMount} theme="vs-light" options={editorOptions} />
      </div>

      <InputDialog dialogRef={subjectDialogRef} />
    </div>
  );
});

export default MarkdownEditor;

export function EditorButton({ icon: Icon, onClick, title = undefined, size = 16, className = '' }) {
  const buttonClassName = ['bg-transparent border border-gray-50 hover:text-amber-600 transition-all duration-200 ease-in-out', className].filter(Boolean).join(' ');

  return (
    <button title={title} onClick={onClick} className={buttonClassName}>
      <Icon size={size} />
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
{"id":"", "title":"Multiple select", "type":"multiple-select" }
A **multiple select** question can have multiple answers. Incorrect selections count against correct ones when calculating the correct percentage."

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This is **not** the right answer
- [x] Another right answer
- [ ] This is **not** the right answer
\`\`\`
`;

const defaultMultipleChoiceInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"Multiple choice", "type":"multiple-choice" }
Simple **multiple choice** question"

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;
const defaultEssayInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"Essay", "type":"essay" }
Simple **essay** question"
\`\`\`
`;

const defaultFileInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"File submission", "type":"file-submission", "allowComment":true  }
Simple **submission** by file
\`\`\`
`;

const defaultUrlInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"URL submission", "type":"url-submission", "allowComment":true }
Simple **submission** by url
\`\`\`
`;
