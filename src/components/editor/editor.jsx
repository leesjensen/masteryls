import React from 'react';
import Instruction from '../instruction/instruction.jsx';
import MarkdownEditor from './markdownEditor';
import EditorFiles from './editorFiles';
import EmbeddedInstruction from '../instruction/embeddedInstruction.jsx';
import EditorCommits from '../../components/EditorCommits';
import useEditorPreviewSync from '../../hooks/useEditorPreviewSync';
import useSplitPaneState from '../../hooks/useSplitPaneState';
import useTopicContentLifecycle from '../../hooks/useTopicContentLifecycle';
import Splitter from '../Splitter.jsx';

export default function Editor({ courseOps, user, learningSession }) {
  const [showCommits, setShowCommits] = React.useState(false);
  const [diffContent, setDiffContent] = React.useState(null);

  // Ref to access MarkdownEditor's insert functionality
  const markdownEditorRef = React.useRef(null);

  const { panePercent: editorPanePercent, splitContainerRef, onPaneMoved: onEditorPaneMoved, onPaneResized: onEditorPaneResized } = useSplitPaneState(55);

  const contentAvailable = !!(learningSession?.topic && learningSession.topic.path && (!learningSession.topic.state || learningSession.topic.state === 'published'));

  const { content, setContent, committing, dirty, setDirty, handleEditorChange, discard, commit } = useTopicContentLifecycle({
    courseOps,
    learningSession,
    contentAvailable,
    onTopicLoaded: () => setDiffContent(null),
  });

  const { previewPaneRef, handleEditorReady } = useEditorPreviewSync({
    topicId: learningSession.topic?.id,
    content,
    editorPanePercent,
  });

  function toggleShowCommits() {
    setShowCommits((v) => !v);
    setDiffContent(null);
  }

  if (!contentAvailable) {
    return <div className="flex p-4 w-full select-none disabled bg-gray-200 text-gray-700">This topic content must be generated before it can be viewed.</div>;
  }

  function getEditor() {
    let editor = null;
    if (learningSession.topic?.type !== 'embedded' && learningSession.topic?.type !== 'video') {
      editor = <MarkdownEditor ref={markdownEditorRef} course={learningSession.course} currentTopic={learningSession.topic} content={content} diffContent={diffContent} onChange={handleEditorChange} commit={commit} onEditorReady={handleEditorReady} />;
    }
    return editor;
  }

  const editorComponent = (type) => {
    switch (type) {
      case 'embedded':
      case 'video':
        return (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="basis-[32px] pt-2 flex items-center justify-between">
              <h1 className="text-lg font-bold pl-2 text-gray-800 mr-2">
                Editor
                <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
              </h1>

              <div className="flex flex-1 pb-1">
                <div className="flex-1 mx-2">
                  <input id="url" type="text" value={content} onChange={(e) => handleEditorChange(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                    Discard
                  </button>
                  <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                    Commit
                  </button>
                </div>
              </div>
            </div>
            <EmbeddedInstruction learningSession={{ ...learningSession, topic: { ...learningSession.topic, path: content } }} />
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="basis-[32px] pt-2 flex items-center justify-between">
              <h1 className={`text-lg font-bold pl-2 text-gray-800 mr-2`}>
                Editor <sup className="inline-block w-[1ch] text-center">{dirty ? '*' : ''}</sup>
              </h1>

              <div className="flex">
                <div className="flex-1"></div>
                <div className="flex items-center gap-2">
                  <button className="mx-1 px-3 py-1 w-28 whitespace-nowrap bg-gray-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-50 text-xs gap-2" onClick={toggleShowCommits}>
                    {showCommits ? 'Hide' : 'Show'} Commits
                  </button>
                  <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={discard} disabled={!dirty || committing}>
                    Discard
                  </button>
                  <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs flex items-center gap-2" onClick={commit} disabled={!dirty || committing}>
                    Commit
                  </button>
                </div>
              </div>
            </div>
            {showCommits && <EditorCommits currentTopic={learningSession.topic} course={learningSession.course} user={user} courseOps={courseOps} setContent={setContent} setDiffContent={setDiffContent} setDirty={setDirty} />}
            <div className="flex-8/10 flex overflow-hidden min-w-0  border-1 border-gray-300 rounded mx-2" ref={splitContainerRef}>
              <div className="flex h-full overflow-hidden min-w-0 shrink-0" style={{ width: `${editorPanePercent}%` }}>
                {getEditor()}
              </div>
              <Splitter onMove={onEditorPaneMoved} onResized={onEditorPaneResized} minPosition={0} maxPosition={window.innerWidth} />
              <div ref={previewPaneRef} className="h-full flex-1 min-w-0 overflow-auto border-l border-gray-200 bg-white">
                <Instruction courseOps={courseOps} learningSession={learningSession} user={user} content={content} instructionState="preview" />
              </div>
            </div>
            <div className="flex-2/10 flex overflow-hidden">
              <EditorFiles courseOps={courseOps} course={learningSession.course} currentTopic={learningSession.topic} onInsertFiles={(files) => markdownEditorRef.current.insertFiles(files)} />
            </div>
            {committing && (
              <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-sm font-medium">Committing changes...</span>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return editorComponent(learningSession.topic?.type);
}
