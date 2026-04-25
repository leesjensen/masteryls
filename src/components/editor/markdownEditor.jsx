import React from 'react';
import { Bold, Italic, Code, Heading2, Heading3, Table, List, ListOrdered, Link, Image as ImageIcon, CircleDot, SquareX, BookOpenCheck, FileUp, CloudUpload, ListChecks, TextSelect, Bot, WrapText, GitCompare, WandSparkles, ImagePlus } from 'lucide-react';
import MonacoMarkdownEditor from '../../components/MonacoMarkdownEditor';
import { aiQuizGenerator, aiSectionGenerator, aiGeneralPromptResponse, aiSelectedMarkdownModifier, aiImageGenerator } from '../../ai/aiContentGenerator';
import InputDialog from '../../hooks/inputDialog';
import TopicLinkDialog from './topicLinkDialog';
import ImageInsertDialog from './imageInsertDialog';
import { createTopicLinkMarkdown } from './topicLinkUtils';
import { cleanFilename, extensionFromMimeType, toUploadDescriptor } from './fileUploadUtils';

const defaultImagePlaceholderUrl = 'https://images.unsplash.com/photo-1767597186218-813e8e6c44d6?q=80&w=400';
const PASTE_HANDLED_FLAG = '__masterylsPasteHandled';

function splitNameAndExtension(fileName) {
  const clean = String(fileName || '').trim();
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === clean.length - 1) {
    return { base: clean || 'pasted-image', extension: '' };
  }

  return {
    base: clean.slice(0, dotIndex),
    extension: clean.slice(dotIndex + 1),
  };
}

function buildUniqueFileName(fileName, existingNames) {
  const { base, extension } = splitNameAndExtension(fileName);
  const safeBase = cleanFilename(base || 'pasted-image') || 'pasted-image';
  const safeExtension = cleanFilename(extension || '').replace(/^\.+/, '');
  const initialName = safeExtension ? `${safeBase}.${safeExtension}` : safeBase;

  if (!existingNames.has(initialName)) {
    return initialName;
  }

  let index = 1;
  while (true) {
    const candidate = safeExtension ? `${safeBase}-${index}.${safeExtension}` : `${safeBase}-${index}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

async function readImageDimensions(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Failed to load pasted image.'));
      nextImage.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      image,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function resizeImageFile(file, targetWidth, targetHeight) {
  const { width: originalWidth, height: originalHeight, image } = await readImageDimensions(file);
  if (targetWidth === originalWidth && targetHeight === originalHeight) {
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to resize image.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputType = String(file.type || '').startsWith('image/') ? file.type : 'image/png';
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Image resize failed.'));
          return;
        }
        resolve(result);
      },
      outputType,
      0.92,
    );
  });

  return new File([blob], file.name, { type: blob.type, lastModified: Date.now() });
}

function base64ImageToFile(base64Data, fileName, mimeType = 'image/png') {
  const binaryString = window.atob(String(base64Data || '').replace(/^data:[^,]+,/, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: mimeType, lastModified: Date.now() });
}

function suggestedAiImageName(prompt, mimeType) {
  const extension = extensionFromMimeType(mimeType);
  const slug = String(prompt || 'ai-generated-image')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '');
  return `ai-${slug || 'generated-image'}.${extension}`;
}

function ensureMasterylsFence(markdown) {
  const trimmed = String(markdown || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^```masteryls\b[\s\S]*```$/i.test(trimmed)) {
    return trimmed;
  }

  const genericFenceMatch = trimmed.match(/^```[\w-]*\s*\n?([\s\S]*?)\n?```$/i);
  if (genericFenceMatch) {
    return `\`\`\`masteryls\n${genericFenceMatch[1].trim()}\n\`\`\``;
  }

  return `\`\`\`masteryls\n${trimmed}\n\`\`\``;
}

function toLines(value) {
  return String(value || '').split(/\r?\n/);
}

function compressLineNumbers(lineNumbers) {
  const sorted = Array.from(new Set(lineNumbers)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return [];
  }

  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push([start, prev]);
    start = current;
    prev = current;
  }
  ranges.push([start, prev]);
  return ranges;
}

function fallbackChangedLines(baseLines, currentLines) {
  const changed = [];
  const length = Math.max(baseLines.length, currentLines.length);
  for (let index = 0; index < length; index += 1) {
    if (baseLines[index] !== currentLines[index]) {
      changed.push(index + 1);
    }
  }
  return changed;
}

function computeChangedLineMarkers(baseText, currentText) {
  const baseLines = toLines(baseText);
  const currentLines = toLines(currentText);

  const n = baseLines.length;
  const m = currentLines.length;

  // Fallback for very large files to keep updates responsive.
  if (n * m > 1000000) {
    return {
      changedRanges: compressLineNumbers(fallbackChangedLines(baseLines, currentLines)),
      deletedAnchors: [],
    };
  }

  const lcs = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (baseLines[i] === currentLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const changedLines = [];
  const deletedAnchors = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (baseLines[i] === currentLines[j]) {
      i += 1;
      j += 1;
      continue;
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      deletedAnchors.push(j + 1);
      i += 1;
    } else {
      changedLines.push(j + 1);
      j += 1;
    }
  }

  while (j < m) {
    changedLines.push(j + 1);
    j += 1;
  }

  while (i < n) {
    deletedAnchors.push(m > 0 ? Math.min(m, Math.max(1, j)) : 1);
    i += 1;
  }

  return {
    changedRanges: compressLineNumbers(changedLines),
    deletedAnchors: Array.from(new Set(deletedAnchors.filter((line) => Number.isFinite(line) && line >= 1))),
  };
}

const MarkdownEditor = React.forwardRef(function MarkdownEditor({ course, currentTopic, content, committedContent, diffContent, onChange, commit, onEditorReady, onPasteFiles, onPasteCommitStateChange, getExistingTopicFileNames }, ref) {
  const [editorOptions, setEditorOptions] = React.useState({ wordWrap: 'on', lineNumbers: 'on', changedLines: 'on' });
  const [editorLoaded, setEditorLoaded] = React.useState(false);
  const [generatingContent, setGeneratingContent] = React.useState(false);
  const editorRef = React.useRef(null);
  const monacoRef = React.useRef(null);
  const changedLineDecorationIdsRef = React.useRef([]);
  const subjectDialogRef = React.useRef(null);
  const topicLinkDialogRef = React.useRef(null);
  const imageInsertDialogRef = React.useRef(null);

  React.useEffect(() => {
    const savedOptions = localStorage.getItem('markdownEditorOptions');
    if (savedOptions) {
      const parsed = JSON.parse(savedOptions);
      setEditorOptions((prev) => ({ ...prev, ...parsed, changedLines: parsed.changedLines || 'on' }));
    }
  }, []);

  const updateChangedLineDecorations = React.useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return;
    }

    if (diffContent || editorOptions.changedLines === 'off') {
      changedLineDecorationIdsRef.current = editor.deltaDecorations(changedLineDecorationIdsRef.current, []);
      return;
    }

    const baseline = String(committedContent || '');
    const current = String(content || '');
    if (baseline === current) {
      changedLineDecorationIdsRef.current = editor.deltaDecorations(changedLineDecorationIdsRef.current, []);
      return;
    }

    const markers = computeChangedLineMarkers(baseline, current);
    const changedDecorations = markers.changedRanges.map(([startLine, endLine]) => ({
      range: new monaco.Range(startLine, 1, endLine, 1),
      options: {
        isWholeLine: true,
        className: 'mls-line-changed-bg',
        linesDecorationsClassName: 'mls-line-changed-gutter',
      },
    }));

    const deletedDecorations = markers.deletedAnchors.map((lineNumber) => ({
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        linesDecorationsClassName: 'mls-line-deleted-gutter',
      },
    }));

    changedLineDecorationIdsRef.current = editor.deltaDecorations(changedLineDecorationIdsRef.current, [...changedDecorations, ...deletedDecorations]);
  }, [committedContent, content, diffContent, editorOptions.changedLines]);

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
    monacoRef.current = monaco;
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

    const handlePaste = async (event) => {
      if (!textEditor.hasTextFocus?.()) {
        return;
      }

      if (event?.[PASTE_HANDLED_FLAG]) {
        return;
      }

      const items = Array.from(event?.clipboardData?.items || []);
      const imageFiles = items
        .filter((item) => item?.kind === 'file' && String(item?.type || '').startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter(Boolean);

      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event[PASTE_HANDLED_FLAG] = true;

      const existingNames = new Set((await getExistingTopicFileNames?.()) || []);

      for (const imageFile of imageFiles) {
        const initialDescriptor = toUploadDescriptor(imageFile);
        const suggestedName = buildUniqueFileName(initialDescriptor.name, existingNames);
        const dimensions = await readImageDimensions(imageFile);
        const objectUrl = URL.createObjectURL(imageFile);

        let dialogResult = null;
        try {
          dialogResult = await imageInsertDialogRef.current?.show({
            suggestedName,
            originalDimensions: dimensions,
            previewObjectUrl: objectUrl,
          });
        } finally {
          URL.revokeObjectURL(objectUrl);
        }

        if (!dialogResult) {
          return;
        }

        onPasteCommitStateChange?.(true);

        const requestedNameSanitized = cleanFilename(dialogResult.fileName?.trim()) || suggestedName;
        const requestedWithExt = requestedNameSanitized.includes('.') ? requestedNameSanitized : `${requestedNameSanitized}.${extensionFromMimeType(imageFile.type)}`;
        const finalFileName = buildUniqueFileName(requestedWithExt, existingNames);
        const targetWidth = Number(dialogResult.width) || dimensions.width;
        const targetHeight = Math.max(1, Math.round((targetWidth / dimensions.width) * dimensions.height));

        const resizedFile = await resizeImageFile(imageFile, targetWidth, targetHeight);

        const renamedFile = new File([resizedFile], finalFileName, {
          type: resizedFile.type || imageFile.type || 'image/png',
          lastModified: Date.now(),
        });

        const uploadDescriptor = toUploadDescriptor(renamedFile);
        try {
          await onPasteFiles?.([uploadDescriptor]);
          insertFiles([uploadDescriptor.name]);
          existingNames.add(uploadDescriptor.name);
        } finally {
          onPasteCommitStateChange?.(false);
        }
      }
    };

    window.addEventListener('paste', handlePaste, true);
    textEditor.onDidDispose?.(() => {
      window.removeEventListener('paste', handlePaste, true);
    });
  }

  React.useEffect(() => {
    return () => onEditorReady?.(null);
  }, []);

  React.useEffect(() => {
    updateChangedLineDecorations();
  }, [updateChangedLineDecorations]);

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

  const insertLink = async () => {
    const topics = Array.isArray(course?.allTopics) ? course.allTopics : [];

    if (topics.length === 0) {
      window.alert('No topics available to link.');
      return;
    }

    const topic = await topicLinkDialogRef.current?.show({ topics });
    if (!topic) return;

    const markdown = createTopicLinkMarkdown(course.id, topic);
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
      try {
        setGeneratingContent(true);
        const topic = currentTopic.description || currentTopic.title;
        const response = '\n' + (await aiSectionGenerator(topic, subject)) + '\n';
        insertText(response);
      } finally {
        setGeneratingContent(false);
      }
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
      try {
        setGeneratingContent(true);
        const topic = currentTopic.description || currentTopic.title;
        const rawResponse = await aiQuizGenerator(topic, subject);
        const fencedResponse = ensureMasterylsFence(rawResponse);
        const withId = fencedResponse.replace(/"id"\s*:\s*"[^"]*"/, `"id":"${crypto.randomUUID()}"`);
        insertText(`\n${withId}\n`);
      } finally {
        setGeneratingContent(false);
      }
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
      try {
        setGeneratingContent(true);
        const topic = currentTopic.description || currentTopic.title;
        const response = '\n' + (await aiGeneralPromptResponse(topic, subject)) + '\n';
        insertText(response);
      } finally {
        setGeneratingContent(false);
      }
    }
  };

  const modifySelectedMarkdown = async () => {
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    const model = editor?.getModel();
    const selectedMarkdown = selection && model ? model.getValueInRange(selection) : '';

    if (!selectedMarkdown.trim()) {
      window.alert('Select markdown in the editor before using AI modify.');
      editor?.focus();
      return;
    }

    const prompt = await subjectDialogRef.current.show({
      title: 'Modify selection',
      description: 'How should AI change the selected markdown?',
      placeholder: 'e.g., make this clearer and add one concise example',
      confirmButtonText: 'Apply',
      required: true,
      multiline: true,
      rows: 5,
    });

    if (!prompt) {
      editor?.focus();
      return;
    }

    try {
      setGeneratingContent(true);
      const topic = currentTopic.description || currentTopic.title;
      const replacement = await aiSelectedMarkdownModifier(topic, content, selectedMarkdown, prompt);
      editor.pushUndoStop?.();
      editor.executeEdits('ai-selection-modifier', [
        {
          range: selection,
          text: replacement,
          forceMoveMarkers: true,
        },
      ]);
      editor.pushUndoStop?.();
      editor.focus();
    } catch (error) {
      window.alert(`Failed to modify selection: ${error.message}`);
    } finally {
      setGeneratingContent(false);
    }
  };

  const generateAndInsertAiImage = async () => {
    const editor = editorRef.current;
    const insertionSelection = editor?.getSelection();

    const prompt = await subjectDialogRef.current.show({
      title: 'Generate image',
      description: 'Describe the image to generate for this topic.',
      placeholder: 'e.g., a clear diagram of the event loop moving tasks between queues',
      confirmButtonText: 'Generate',
      required: true,
      multiline: true,
      rows: 5,
    });

    if (!prompt) {
      editor?.focus();
      return;
    }

    let previewObjectUrl = '';
    let dialogResult = null;
    try {
      setGeneratingContent(true);
      const generatedImage = await aiImageGenerator(prompt);
      const initialFile = base64ImageToFile(generatedImage.data, suggestedAiImageName(prompt, generatedImage.mimeType), generatedImage.mimeType);
      const dimensions = await readImageDimensions(initialFile);
      const existingNames = new Set((await getExistingTopicFileNames?.()) || []);
      const suggestedName = buildUniqueFileName(initialFile.name, existingNames);
      previewObjectUrl = URL.createObjectURL(initialFile);
      setGeneratingContent(false);

      dialogResult = await imageInsertDialogRef.current?.show({
        title: 'Generated image',
        description: 'Preview the image, then confirm the file name and size before inserting it.',
        confirmButtonText: 'Use image',
        suggestedName,
        originalDimensions: dimensions,
        previewObjectUrl,
      });

      if (!dialogResult) {
        editor?.focus();
        return;
      }

      onPasteCommitStateChange?.(true);

      const requestedNameSanitized = cleanFilename(dialogResult.fileName?.trim()) || suggestedName;
      const requestedWithExt = requestedNameSanitized.includes('.') ? requestedNameSanitized : `${requestedNameSanitized}.${extensionFromMimeType(initialFile.type)}`;
      const finalFileName = buildUniqueFileName(requestedWithExt, existingNames);
      const targetWidth = Number(dialogResult.width) || dimensions.width;
      const targetHeight = Math.max(1, Math.round((targetWidth / dimensions.width) * dimensions.height));
      const resizedFile = await resizeImageFile(initialFile, targetWidth, targetHeight);
      const renamedFile = new File([resizedFile], finalFileName, {
        type: resizedFile.type || initialFile.type || 'image/png',
        lastModified: Date.now(),
      });
      const uploadDescriptor = toUploadDescriptor(renamedFile, 'ai-generated-image');

      if (insertionSelection && editor) {
        editor.setSelection(insertionSelection);
      }
      await onPasteFiles?.([uploadDescriptor]);
      insertFiles([uploadDescriptor.name]);
      existingNames.add(uploadDescriptor.name);
    } catch (error) {
      window.alert(`Failed to generate image: ${error.message}`);
    } finally {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
      setGeneratingContent(false);
      onPasteCommitStateChange?.(false);
      editor?.focus();
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

  const toggleChangedLines = () => {
    const nextChangedLines = editorOptions.changedLines === 'off' ? 'on' : 'off';
    saveEditorOptions({ ...editorOptions, changedLines: nextChangedLines });
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
            <EditorButton icon={GitCompare} className={getToggleColor(editorOptions.changedLines)} onClick={toggleChangedLines} title={`Changed Lines: ${getToggleText(editorOptions.changedLines)}`} />
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
          <EditorButton icon={ImageIcon} onClick={() => insertText(`![alt text](${defaultImagePlaceholderUrl})`)} title="Image" />
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
          <EditorButton icon={WandSparkles} onClick={() => modifySelectedMarkdown()} title="AI modify selected markdown" />
          <EditorButton icon={ImagePlus} onClick={() => generateAndInsertAiImage()} title="AI generated image" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <MonacoMarkdownEditor content={content} diffContent={diffContent} onChange={onChange} onMount={handleEditorDidMount} theme="vs-light" options={editorOptions} />
      </div>

      {generatingContent && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
          <div className="flex items-center gap-3 text-gray-700">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
            <span className="text-sm font-medium">Generating content...</span>
          </div>
        </div>
      )}

      <TopicLinkDialog ref={topicLinkDialogRef} />

      <ImageInsertDialog ref={imageInsertDialogRef} />

      <InputDialog dialogRef={subjectDialogRef} />
    </div>
  );
});

export default MarkdownEditor;

export function EditorButton({ icon: Icon, onClick, title = undefined, size = 16, className = '' }) {
  const buttonClassName = ['bg-transparent border border-gray-50 hover:text-amber-600 transition-all duration-200 ease-in-out', className].filter(Boolean).join(' ');

  return (
    <button title={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className={buttonClassName}>
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
Simple **multiple choice** question

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`
`;
const defaultEssayInteractionTemplate = `
\`\`\`masteryls
{"id":"", "title":"Essay", "type":"essay" }
Simple **essay** question
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
