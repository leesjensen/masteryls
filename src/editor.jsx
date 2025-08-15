import React from 'react';

export default function Editor({ course, setCourse, currentTopic, changeTopic }) {
  const [content, setContent] = React.useState('');
  const [dirty, setDirty] = React.useState(false);

  const dirtyRef = React.useRef(dirty);
  const contentRef = React.useRef(content);
  dirtyRef.current = dirty;
  contentRef.current = content;

  React.useEffect(() => {
    if (currentTopic?.path) {
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

    const [updatedCourse, savedTopic] = await course.saveTopicMarkdown(currentTopic, content);
    setDirty(false);
    setCourse(updatedCourse);
    changeTopic(savedTopic);
  }

  async function discard() {
    const [updatedCourse, previousTopic, markdown] = await course.discardTopicMarkdown(currentTopic);
    setDirty(false);
    setContent(markdown);
    changeTopic(previousTopic);
    setCourse(updatedCourse);
  }

  async function commit() {
    const [updatedCourse, committedTopic] = await course.commitTopicMarkdown(currentTopic);
    setDirty(false);
    changeTopic(committedTopic);
    setCourse(updatedCourse);
  }

  return (
    <div className="p-2 flex-1 flex flex-col">
      <div className="basis-[32px] flex items-center justify-between">
        <span className="text-xs text-gray-500">{currentTopic?.lastUpdated && `Modified: ${new Date(currentTopic.lastUpdated).toLocaleString()}`}</span>
        <div className="flex items-center">
          <button className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs" onClick={() => save(content)} disabled={!dirty}>
            Save
          </button>
          <button
            className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs"
            onClick={discard}
            disabled={dirty || !currentTopic?.lastUpdated}
          >
            Discard
          </button>
          <button
            className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:hover:bg-gray-400 text-xs"
            onClick={commit}
            disabled={dirty || !currentTopic?.lastUpdated}
          >
            Commit
          </button>
        </div>
      </div>
      <pre className="flex-1 flex">
        <textarea
          className="flex-1 text-sm border rounded p-2"
          value={content}
          wrap="off"
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
        />
      </pre>
    </div>
  );
}
