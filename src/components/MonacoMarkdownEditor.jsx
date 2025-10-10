import React, { useRef } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useMonacoSpellChecker } from './MonacoSpellChecker';

const MonacoMarkdownEditor = ({ content, diffContent, onChange, onMount, readOnly = false, height = '100%', width = '100%', theme = 'vs-dark' }) => {
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

    // Setup spell checker if enabled and not in compare mode
    if (spellCheckerRef.current && !diffContent) {
      spellCheckerRef.current.setupEditor(editor, monaco);
    }

    // Call the external onMount handler if provided
    if (onMount) {
      onMount(editor, monaco);
    }
  }

  function handleDiffEditorDidMount(diffEditor, monaco) {
    editorRef.current = diffEditor;

    monaco.languages.setLanguageConfiguration('markdown', {
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    });

    // Set up onChange listener for the modified editor (right side)
    if (onChange && diffEditor.getModifiedEditor) {
      const modifiedEditor = diffEditor.getModifiedEditor();
      modifiedEditor.onDidChangeModelContent(() => {
        const value = modifiedEditor.getValue();
        onChange(value);
      });
    }

    // Call the external onMount handler if provided
    if (onMount) {
      onMount(diffEditor, monaco);
    }
  }

  const editorOptions = {
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
  };

  if (diffContent) {
    return <DiffEditor height={height} width={width} language="markdown" original={diffContent} modified={content} keepCurrentOriginalModel={true} keepCurrentModifiedModel={true} onMount={handleDiffEditorDidMount} theme={theme} options={{ ...editorOptions, originalEditable: false, enableSplitViewResizing: true, renderSideBySide: true, ignoreTrimWhitespace: false, renderIndicators: true }} />;
  }

  return <Editor height={height} width={width} language="markdown" value={content} onChange={onChange} onMount={handleEditorDidMount} theme={theme} options={editorOptions} />;
};

export default MonacoMarkdownEditor;
