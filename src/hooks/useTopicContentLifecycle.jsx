import React from 'react';
import useLatest from './useLatest';

export default function useTopicContentLifecycle({ courseOps, learningSession, contentAvailable, onTopicLoaded }) {
  const [content, setContent] = React.useState('');
  const [committing, setCommitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const dirtyRef = useLatest(dirty);
  const contentRef = useLatest(content);

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

  async function discard() {
    let nextContent = '';
    if (learningSession.topic?.type === 'embedded' || learningSession.topic?.type === 'video') {
      nextContent = learningSession.topic.path || '';
    } else {
      nextContent = await courseOps.getTopic(learningSession.topic);
    }
    setDirty(false);
    setContent(nextContent);
  }

  function handleEditorChange(value) {
    if (committing) return;
    setContent(value || '');
    setDirty(true);
  }

  React.useEffect(() => {
    if (!contentAvailable) return;

    if (learningSession.topic?.type === 'embedded' || learningSession.topic?.type === 'video') {
      setContent(learningSession.topic.path || '');
    } else {
      courseOps.getTopic(learningSession.topic).then((markdown) => {
        setContent(markdown);
      });
    }

    onTopicLoaded?.();
    setDirty(false);

    return () => {
      if (dirtyRef.current) {
        if (window.confirm('You have unsaved changes. Do you want to commit them before leaving?')) {
          void commit();
        }
      }
    };
  }, [learningSession]);

  return {
    content,
    setContent,
    committing,
    dirty,
    setDirty,
    handleEditorChange,
    discard,
    commit,
  };
}
