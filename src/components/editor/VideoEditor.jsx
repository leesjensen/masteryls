import React, { useState } from 'react';
import VideoInstruction from '../instruction/videoInstruction';

export default function VideoEditor({ learningSession }) {
  const [url, setUrl] = useState(learningSession?.topic?.path || '');
  const [dirty, setDirty] = useState(false);

  React.useEffect(() => {
    setUrl(learningSession?.topic?.path || '');
    setDirty(false);
  }, [learningSession]);

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setDirty(true);
  };

  const handleSave = async () => {
    // if (!dirty) return;
    // // This should be an updateTopicVideo function in Course class
    // const updatedTopic = { ...currentTopic, path: url };
    // const updatedCourse = await Course.create({ ...course });
    // for (const module of updatedCourse.modules) {
    //   const topicIdx = module.topics.findIndex((t) => t.id === updatedTopic.id);
    //   if (topicIdx !== -1) {
    //     module.topics[topicIdx] = updatedTopic;
    //     break;
    //   }
    // }
    // setCourse(updatedCourse);
    // changeTopic(updatedTopic);
    // setDirty(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-2 border-b border-gray-200 text-sm text-gray-500 flex items-center gap-2">
        <strong>URL</strong>
        <input type="text" value={url} onChange={handleUrlChange} className="border rounded px-2 py-1 text-sm flex-1" style={{ minWidth: '200px' }} />
        <button className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-xs" onClick={handleSave} disabled={!dirty}>
          Save
        </button>
      </div>
      <VideoInstruction learningSession={{ ...learningSession, topic: { ...learningSession.topic, path: url } }} />
    </div>
  );
}
