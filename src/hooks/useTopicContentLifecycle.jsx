import React from 'react';
import useLatest from './useLatest';

export default function useTopicContentLifecycle({ courseOps, learningSession, contentAvailable, onTopicLoaded }) {
  const [content, setContentState] = React.useState('');
  // Bumped only when `content` is replaced from a NON-keystroke source (topic load,
  // discard, apply-commit). The editor uses this signal to know when to re-apply text
  // into the model; keystroke updates do not bump it, so typing never re-applies (which
  // would move the caret). See MonacoMarkdownEditor.
  const [contentEpoch, setContentEpoch] = React.useState(0);
  const [committedContent, setCommittedContent] = React.useState('');
  const [committing, setCommitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const dirtyRef = useLatest(dirty);
  const contentRef = useLatest(content);

  // Replace content from an external source (not the editor's own typing).
  function setContentExternal(next) {
    setContentState(next);
    setContentEpoch((epoch) => epoch + 1);
  }

  async function commit() {
    if (committing || !dirtyRef.current) return;

    setCommitting(true);
    try {
      await courseOps.updateTopic(learningSession.topic, contentRef.current);
      setCommittedContent(contentRef.current);
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
    setContentExternal(nextContent);
    setCommittedContent(nextContent);
  }

  function handleEditorChange(value) {
    if (committing) return;
    // Editor-originated change: update state WITHOUT bumping the epoch so the editor
    // does not re-apply its own text (which would move the caret).
    setContentState(value || '');
    setDirty(true);
  }

  React.useEffect(() => {
    if (!contentAvailable) return;

    if (learningSession.topic?.type === 'embedded' || learningSession.topic?.type === 'video') {
      const nextContent = learningSession.topic.path || '';
      setContentExternal(nextContent);
      setCommittedContent(nextContent);
    } else {
      courseOps.getTopic(learningSession.topic).then((markdown) => {
        const nextContent = markdown || '';
        setContentExternal(nextContent);
        setCommittedContent(nextContent);
      });
    }

    onTopicLoaded?.();
    setDirty(false);
    // Depend on topic identity, not the whole learningSession object: a save/commit or
    // an interaction-structure update republishes learningSession with a new reference
    // for the SAME topic, which would otherwise refetch and reset in-progress edits.
  }, [learningSession.topic?.id, learningSession.topic?.path, contentAvailable]);

  React.useEffect(() => {
    function handleBeforeUnload(e) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    content,
    contentEpoch,
    committedContent,
    // Consumers (e.g. EditorCommits applying a revision) are external sources, so the
    // exposed setter bumps the epoch to make the editor re-apply the new text.
    setContent: setContentExternal,
    committing,
    dirty,
    setDirty,
    handleEditorChange,
    discard,
    commit,
  };
}
