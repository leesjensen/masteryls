import React from 'react';

export default function Editor({ topic, course }) {
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    if (topic.path) {
      course.topicMarkdown(topic).then((markdown) => {
        setContent(markdown);
      });
    }
  }, [topic]);

  return (
    <div className="p-2 flex-1 flex flex-col">
      <div className="basis-[32px] flex items-center justify-end">
        <button
          className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
          onClick={() => {
            course.saveTopicMarkdown(topic, content);
          }}
        >
          Save
        </button>
        <button
          className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
          onClick={async () => {
            const markdown = await course.revertTopicMarkdown(topic);
            setContent(markdown);
          }}
        >
          Revert
        </button>
        <button
          className="mx-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
          onClick={() => {
            alert('Commit functionality not implemented yet');
          }}
        >
          Commit
        </button>
      </div>
      <textarea className="flex-1 text-xs border rounded p-2" value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} />
    </div>
  );
}
