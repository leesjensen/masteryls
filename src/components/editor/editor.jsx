import React from 'react';
import Instruction from '../instruction/instruction.jsx';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import VideoEditor from './VideoEditor';
import EditorCommits from '../../components/EditorCommits';
import useLatest from '../../hooks/useLatest';

export default function Editor({ courseOps, user, learningSession }) {
  const [content, setContent] = React.useState('');
  const [editorState, setEditorState] = React.useState('learning'); // 'editing' | 'preview'
  const [showCommits, setShowCommits] = React.useState(false);
  const [diffContent, setDiffContent] = React.useState(null);

  const [committing, setCommitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const dirtyRef = useLatest(dirty);
  const contentRef = useLatest(content);

  // Ref to access MarkdownEditor's insert functionality
  const markdownEditorRef = React.useRef(null);

  const contentAvailable = !!(learningSession?.topic && learningSession.topic.path && (!learningSession.topic.state || learningSession.topic.state === 'stable'));

  React.useEffect(() => {
    if (contentAvailable) {
      courseOps.getTopicMarkdown(learningSession.course, learningSession.topic).then((markdown) => {
        setContent(markdown);
        setDirty(false);
      });

      return async () => {
        if (dirtyRef.current) {
          if (window.confirm('You have unsaved changes. Do you want to commit them before leaving?')) {
            await commit();
          }
        }
      };
    }
  }, [learningSession]);

  function handleEditorChange(value) {
    if (committing) return;
    setContent(value || '');
    setDirty(true);
  }

  async function discard() {
    const markdown = await courseOps.discardTopicMarkdown(learningSession.topic);
    setDirty(false);
    setContent(markdown);
  }

  async function commit() {
    if (committing || !dirtyRef.current) return;

    setCommitting(true);
    try {
      await courseOps.updateTopic(learningSession.topic, contentRef.current);
      setDirty(false);
    } catch (error) {
      alert('Failed to commit changes. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  function toggleShowCommits() {
    setShowCommits((v) => !v);
    setDiffContent(null);
  }

  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  function getEditor() {
    let editor = null;
    if (learningSession.topic?.type !== 'video') {
      editor = <MarkdownEditor ref={markdownEditorRef} currentTopic={learningSession.topic} content={content} diffContent={diffContent} onChange={handleEditorChange} commit={commit} user={user} />;
      if (editorState === 'preview') {
        editor = <Instruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState={editorState} />;
      }
    }
    return editor;
  }

  const editorComponent = (type) => {
    switch (type) {
      case 'video':
        return <VideoEditor learningSession={learningSession} />;
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {committing && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-sm font-medium">Committing changes...</span>
                </div>
              </div>
            )}
            <div className="basis-[32px] pt-2 flex items-center justify-between">
              <h1 className={`text-lg font-bold pl-2 text-gray-800`}>Editor{dirty ? '*' : ''}</h1>

              <div className="flex items-center">
                <button className="mx-1 px-3 py-1 w-18 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={() => setEditorState((v) => (v == 'preview' ? 'editing' : 'preview'))}>
                  {editorState === 'preview' ? 'Edit' : 'Preview'}
                </button>
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                  Discard
                </button>
                <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                  Commit
                </button>
                <button className="mx-1 px-3 py-1 w-28 whitespace-nowrap bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 text-xs gap-2" onClick={toggleShowCommits}>
                  {showCommits ? 'Hide' : 'Show'} Commits
                </button>
              </div>
            </div>
            {showCommits && <EditorCommits currentTopic={learningSession.topic} course={learningSession.course} user={user} courseOps={courseOps} setContent={setContent} setDiffContent={setDiffContent} setDirty={setDirty} />}
            <div className="flex-8/10 flex overflow-hidden">{getEditor()}</div>
            <div className="flex-2/10 flex overflow-hidden">
              <EditorFiles courseOps={courseOps} course={learningSession.course} currentTopic={learningSession.topic} onInsertFiles={(files) => markdownEditorRef.current.insertFiles(files)} />
            </div>
          </div>
        );
    }
  };

  return editorComponent(learningSession.topic?.type);
}
