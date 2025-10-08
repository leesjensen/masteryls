import React, { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import Typo from 'typo-js';

const MonacoMarkdownEditor = ({ value, onChange, onMount, readOnly = false, height = '100%', theme = 'vs-light' }) => {
  const editorRef = useRef(null);
  const [spellChecker, setSpellChecker] = useState(null);
  const decorationsRef = useRef([]);

  // Initialize spell checker
  useEffect(() => {
    // You can load dictionary files from a CDN or local files
    const dictionary = new Typo('en_US', false, false, {
      dictionaryPath: 'https://cdn.jsdelivr.net/npm/typo-js@1.2.1/dictionaries',
      asyncLoad: true,
      loadedCallback: () => {
        setSpellChecker(dictionary);
      },
    });
  }, []);

  // Function to check spelling and highlight misspelled words
  const checkSpelling = (editor, monaco) => {
    if (!spellChecker || !editor) return;

    const model = editor.getModel();
    const text = model.getValue();
    const decorations = [];

    // Word pattern to extract words (excluding markdown syntax)
    const wordPattern = /\b[a-zA-Z]+\b/g;
    let match;

    while ((match = wordPattern.exec(text)) !== null) {
      const word = match[0];
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + word.length);

      // Skip words that are likely markdown syntax or code
      const lineContent = model.getLineContent(startPos.lineNumber);
      const isInCodeBlock = lineContent.includes('`');
      const isInLink = lineContent.includes('[') && lineContent.includes(']');

      if (!isInCodeBlock && !isInLink && !spellChecker.check(word)) {
        decorations.push({
          range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          options: {
            isWholeLine: false,
            className: 'spell-error',
            inlineClassName: 'spell-error-inline',
            hoverMessage: { value: `Misspelled word: "${word}"` },
          },
        });
      }
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  };

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

    // Add CSS for spell check styling
    const style = document.createElement('style');
    style.textContent = `
      .spell-error-inline {
        border-bottom: 2px dotted red;
      }
    `;
    document.head.appendChild(style);

    // Listen for content changes to re-check spelling
    editor.onDidChangeModelContent(() => {
      // Debounce spell checking
      setTimeout(() => checkSpelling(editor, monaco), 500);
    });

    // Initial spell check if spell checker is ready
    if (spellChecker) {
      checkSpelling(editor, monaco);
    }

    // Call the external onMount handler if provided
    if (onMount) {
      onMount(editor, monaco);
    }
  }

  // Re-check spelling when spell checker is ready
  useEffect(() => {
    if (spellChecker && editorRef.current) {
      checkSpelling(editorRef.current, window.monaco);
    }
  }, [spellChecker]);

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
      }}
    />
  );
};

export default MonacoMarkdownEditor;
