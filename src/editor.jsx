import React from 'react';

export default function Editor({ topic, changeTopic, course }) {
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    if (topic.path) {
      course.topicMarkdown(topic.path).then((markdown) => {
        setContent(markdown);
      });
    }
  }, [topic.path]);

  return (
    <div className="h-full overflow-auto p-4">
      <pre className="text-xs">{content}</pre>
    </div>
  );
}
