import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
  }),
  Markdown,
];

function ToolbarButton({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-40 ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}

export default function DraAssessment({ value, onChange, onBlur, readOnly, activeStage }) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value || '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none h-full prose-p:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:mt-3 prose-headings:mb-2 prose-p:leading-4',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.storage.markdown.getMarkdown());
    },
    onBlur() {
      onBlur?.();
    },
  });

  // Swap content when stage changes without destroying the editor.
  const prevStageRef = React.useRef(activeStage);
  React.useEffect(() => {
    if (!editor || activeStage === prevStageRef.current) return;
    prevStageRef.current = activeStage;
    const md = editor.storage.markdown.getMarkdown();
    const incoming = value || '';
    if (md !== incoming) {
      editor.commands.setContent(incoming, false);
    }
  }, [activeStage, value, editor]);

  // Sync readOnly state.
  React.useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [readOnly, editor]);

  const can = editor
    ? {
        h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        h3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        bold: () => editor.chain().focus().toggleBold().run(),
        italic: () => editor.chain().focus().toggleItalic().run(),
        bullet: () => editor.chain().focus().toggleBulletList().run(),
        ordered: () => editor.chain().focus().toggleOrderedList().run(),
      }
    : {};

  const is = editor
    ? {
        h2: editor.isActive('heading', { level: 2 }),
        h3: editor.isActive('heading', { level: 3 }),
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        bullet: editor.isActive('bulletList'),
        ordered: editor.isActive('orderedList'),
      }
    : {};

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {!readOnly && (
        <div className="shrink-0 flex items-center gap-0.5 border-b border-gray-200 px-2 py-1 bg-gray-50">
          <ToolbarButton active={is.h2} onClick={can.h2} title="Heading">
            H2
          </ToolbarButton>
          <ToolbarButton active={is.h3} onClick={can.h3} title="Subheading">
            H3
          </ToolbarButton>
          <span className="w-px h-4 bg-gray-300 mx-1" />
          <ToolbarButton active={is.bold} onClick={can.bold} title="Bold">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton active={is.italic} onClick={can.italic} title="Italic">
            <em>I</em>
          </ToolbarButton>
          <span className="w-px h-4 bg-gray-300 mx-1" />
          <ToolbarButton active={is.bullet} onClick={can.bullet} title="Bullet list">
            • List
          </ToolbarButton>
          <ToolbarButton active={is.ordered} onClick={can.ordered} title="Numbered list">
            1. List
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} className="flex-1 min-h-0 overflow-auto px-3 py-2 text-sm" />
    </div>
  );
}
