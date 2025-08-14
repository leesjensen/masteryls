import React from 'react';

export default function Editor({ course, setCourse, currentTopic, changeTopic }) {
  const [content, setContent] = React.useState('');
  const [dirty, setDirty] = React.useState(false);

  const dirtyRef = React.useRef(dirty);
  const contentRef = React.useRef(content);
  dirtyRef.current = dirty;
  contentRef.current = content;

  React.useEffect(() => {
    if (currentTopic.path) {
      course.topicMarkdown(currentTopic).then((markdown) => {
        setContent(markdown);
        setDirty(false);
      });
    }
    return () => {
      if (dirtyRef.current) {
        const shouldSave = window.confirm('You have unsaved changes. Save before leaving?');
        if (shouldSave) {
          save(contentRef.current);
        }
      }
    };
  }, [currentTopic]);

  async function save(content) {
    console.log('Saving...');

    const [newCourse, newTopic] = await course.saveTopicMarkdown(currentTopic, content);
    setDirty(false);
    setCourse(newCourse);
    changeTopic(newTopic);
  }

  return (
    <div className="p-2 flex-1 flex flex-col">
      <div className="basis-[32px] flex items-center justify-between">
        <span className="text-xs text-gray-300">{currentTopic.lastUpdated && `Modified: ${new Date(currentTopic.lastUpdated).toLocaleString()}`}</span>
        <div className="flex items-center">
          <button
            className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs"
            onClick={async () => {
              await save(content);
            }}
            disabled={!dirty}
          >
            Save
          </button>
          <button
            className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs"
            onClick={async () => {
              const [savedTopic, markdown] = await course.discardTopicMarkdown(currentTopic);
              setDirty(false);
              setContent(markdown);
              changeTopic(savedTopic);
            }}
            disabled={dirty || !currentTopic.lastUpdated}
          >
            Discard
          </button>
          <button
            className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs"
            onClick={() => {
              alert('Commit functionality not implemented yet');
            }}
            disabled={!dirty}
          >
            Commit
          </button>
        </div>
      </div>
      <textarea
        className="flex-1 text-xs border rounded p-2"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
      />
    </div>
  );
}

function useUnsavedChanges(isDirty, onSave) {
  const isDirtyRef = React.useRef(isDirty);
  const onSaveRef = React.useRef(onSave);

  // Always keep refs current
  isDirtyRef.current = isDirty;
  onSaveRef.current = onSave;

  React.useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes.';
        return 'You have unsaved changes.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Effect that only runs on mount/unmount - uses refs for current values
  React.useEffect(() => {
    return () => {
      // This cleanup only runs when component actually unmounts
      if (isDirtyRef.current) {
        const shouldSave = window.confirm('You have unsaved changes. Save before leaving?');
        if (shouldSave && onSaveRef.current) {
          onSaveRef.current();
        }
      }
    };
  }, []); // Empty dependencies - only runs on mount/unmount
}
