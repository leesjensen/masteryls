import React, { useRef } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useMonacoSpellChecker } from './MonacoSpellChecker';

const MonacoMarkdownEditor = ({ content, diffContent, onChange, onMount, readOnly = false, height = '100%', width = '100%', theme = 'vs-dark', options = {} }) => {
  const editorRef = useRef(null);
  const { spellCheckerRef } = useMonacoSpellChecker();

  // The plain (non-diff) editor is intentionally UNCONTROLLED: it is seeded with
  // `defaultValue` and thereafter owns its own text. We must not bind `value={content}`,
  // because @monaco-editor/react's value-sync overwrites the live model whenever the
  // `content` prop differs from it — and during fast typing the React `content` state
  // lags the model by a keystroke, so that overwrite reverts the model and drops the
  // caret at the end of the document. Instead we push content in ourselves, but only
  // for genuinely EXTERNAL changes (topic load, discard, apply-commit) and never for a
  // value the editor itself just emitted (a keystroke echo).
  const lastEditorValueRef = useRef(content); // best-known current editor text
  const applyingExternalRef = useRef(false); // true while we imperatively replace text

  function handleChange(value, ev) {
    lastEditorValueRef.current = value;
    if (applyingExternalRef.current) return; // ignore the echo from our own replace
    if (onChange) onChange(value, ev);
  }

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || diffContent) return;
    const model = editor.getModel?.();
    if (!model) return;

    const current = editor.getValue();
    if (content === current) {
      lastEditorValueRef.current = content;
      return;
    }
    // A value the editor just emitted (typing lag); do NOT clobber the live model.
    if (content === lastEditorValueRef.current) return;

    // Genuine external content change: replace the text, preserving the selection.
    applyingExternalRef.current = true;
    try {
      const selections = editor.getSelections();
      editor.executeEdits('external-content-sync', [{ range: model.getFullModelRange(), text: content ?? '' }]);
      editor.pushUndoStop();
      if (selections) {
        try {
          editor.setSelections(selections);
        } catch {
          // selection may be out of range for the new text; Monaco clamps on next interaction
        }
      }
      lastEditorValueRef.current = content ?? '';
    } finally {
      applyingExternalRef.current = false;
    }
  }, [content, diffContent]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    lastEditorValueRef.current = editor.getValue();

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
    fontFamily: "'Roboto Mono', 'Monaco', monospace",
    wrappingIndent: 'indent',
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
    // Disable the word-completion popup (suggesting words already in the document).
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    wordBasedSuggestions: 'off',
    parameterHints: { enabled: false },
    lineNumbersMinChars: 1,
    lineDecorationsWidth: 0,
    stickyScroll: { enabled: false },
    renderControlCharacters: false,
    unicodeHighlight: {
      nonBasicASCII: false,
      ambiguousCharacters: false,
      invisibleCharacters: false,
    },
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    autoClosingOvertype: 'never',
    autoSurround: 'never',
    autoIndent: 'none',
  };

  if (diffContent) {
    return <DiffEditor height={height} width={width} language="markdown" original={diffContent} modified={content} keepCurrentOriginalModel={true} keepCurrentModifiedModel={true} onMount={handleDiffEditorDidMount} theme={theme} options={{ ...editorOptions, ...options, originalEditable: false, enableSplitViewResizing: true, renderSideBySide: true, ignoreTrimWhitespace: false, renderIndicators: true }} />;
  }

  return <Editor height={height} width={width} language="markdown" defaultValue={content} onChange={handleChange} onMount={handleEditorDidMount} theme={theme} options={{ ...editorOptions, ...options }} />;
};

export default MonacoMarkdownEditor;
