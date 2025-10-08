import { useRef, useState, useEffect } from 'react';
import Typo from 'typo-js';

class MonacoSpellChecker {
  constructor() {
    this.spellChecker = null;
    this.decorationsRef = [];
    this.isInitialized = false;
    this.onReadyCallbacks = [];
  }

  async initialize() {
    if (this.isInitialized) return Promise.resolve();

    return new Promise((resolve) => {
      const dictionary = new Typo('en_US', false, false, {
        dictionaryPath: 'https://cdn.jsdelivr.net/npm/typo-js@1.2.1/dictionaries',
        asyncLoad: true,
        loadedCallback: () => {
          this.spellChecker = dictionary;
          this.isInitialized = true;
          this.onReadyCallbacks.forEach((callback) => callback());
          this.onReadyCallbacks = [];
          resolve();
        },
      });
    });
  }

  onReady(callback) {
    if (this.isInitialized) {
      callback();
    } else {
      this.onReadyCallbacks.push(callback);
    }
  }

  checkSpelling(editor, monaco) {
    if (!this.spellChecker || !editor) return;

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
      const isHeading = lineContent.startsWith('#');

      if (!isInCodeBlock && !isInLink && !isHeading && !this.spellChecker.check(word)) {
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
    this.decorationsRef = editor.deltaDecorations(this.decorationsRef, decorations);
  }

  setupEditor(editor, monaco, options = {}) {
    const { debounceMs = 500 } = options;

    // Add CSS for spell check styling (only once)
    if (!document.querySelector('#monaco-spellcheck-styles')) {
      const style = document.createElement('style');
      style.id = 'monaco-spellcheck-styles';
      style.textContent = `
      .spell-error-inline {
        border-bottom: 1px solid #eecccc;
      }
    `;
      document.head.appendChild(style);
    }

    // Listen for content changes to re-check spelling
    let timeoutId;
    editor.onDidChangeModelContent(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => this.checkSpelling(editor, monaco), debounceMs);
    });

    // Initial spell check if spell checker is ready
    this.onReady(() => {
      this.checkSpelling(editor, monaco);
    });
  }

  clearDecorations(editor) {
    if (editor && this.decorationsRef.length > 0) {
      this.decorationsRef = editor.deltaDecorations(this.decorationsRef, []);
    }
  }
}

// Hook for using spell checker in React components
export function useMonacoSpellChecker() {
  const spellCheckerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!spellCheckerRef.current) {
      spellCheckerRef.current = new MonacoSpellChecker();
      spellCheckerRef.current.initialize().then(() => {
        setIsReady(true);
      });
    }
  }, []);

  return {
    spellCheckerRef,
    isReady,
  };
}

export default MonacoSpellChecker;
