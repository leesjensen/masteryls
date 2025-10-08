import React, { useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useMonacoSpellChecker } from './MonacoSpellChecker';

const MonacoMarkdownEditor = ({ value, onChange, onMount, readOnly = false, height = '100%', theme = 'vs-light' }) => {
  const editorRef = useRef(null);
  const { spellCheckerRef } = useMonacoSpellChecker();

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;

    monaco.languages.setLanguageConfiguration('markdown', {
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      onEnterRules: [
        {
          beforeText: /^\s*[\-\+]\s+.*$/,
          action: { indentAction: monaco.languages.IndentAction.None, appendText: '- ' },
        },
        {
          beforeText: /^\s*[\*\+]\s+.*$/,
          action: { indentAction: monaco.languages.IndentAction.None, appendText: '* ' },
        },
        {
          beforeText: /^\s*\d+\.\s+.*$/,
          action: { indentAction: monaco.languages.IndentAction.None, appendText: '1. ' },
        },
      ],
    });

    // Setup spell checker if enabled
    if (spellCheckerRef.current) {
      spellCheckerRef.current.setupEditor(editor, monaco);
    }

    // Call the external onMount handler if provided
    if (onMount) {
      onMount(editor, monaco);
    }
  }

  return (
    <Editor
      height={height}
      language="markdown"
      value={value}
      onChange={onChange}
      onMount={handleEditorDidMount}
      theme={theme}
      options={{
        readOnly,
        fontSize: 14,
        fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
        wordWrap: 'on',
        wrappingIndent: 'none',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        lineNumbers: 'on',
        folding: true,
        contextmenu: true,
        multiCursorModifier: 'ctrlCmd',
        occurrencesHighlight: false,
        selectionHighlight: true,
        renderLineHighlight: 'gutter',
        guides: {
          indentation: false,
        },
        quickSuggestions: false,
        lineNumbersMinChars: 1,
        lineDecorationsWidth: 0,
      }}
    />
  );
};

export default MonacoMarkdownEditor;
