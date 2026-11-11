import React from 'react';
import useLatest from './useLatest';
import { useAlert } from '../contexts/AlertContext.jsx';

export default function useTopicContentLifecycle({ courseOps, learningSession, contentAvailable, onTopicLoaded }) {
  const { showAlert, showConfirm } = useAlert();
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
  // The blob sha the current editor content is based on. Captured when content loads from HEAD and
  // passed back on commit so a concurrent push on another machine is caught, not silently overwritten.
  const baseShaRef = React.useRef(null);

  // (Re)load the topic's latest content from HEAD and reset the editor to it. Used on topic load,
  // discard, and after a commit conflict.
  async function loadLatest() {
    const topic = learningSession.topic;
    if (topic?.type === 'embedded' || topic?.type === 'video') {
      const next = topic.path || '';
      baseShaRef.current = null;
      setContentExternal(next);
      setCommittedContent(next);
      setDirty(false);
      return;
    }
    const { content: latest, baseSha } = await courseOps.getTopicForEdit(topic);
    baseShaRef.current = baseSha;
    setContentExternal(latest || '');
    setCommittedContent(latest || '');
    setDirty(false);
  }

  // Replace content from an external source (not the editor's own typing).
  function setContentExternal(next) {
    setContentState(next);
    setContentEpoch((epoch) => epoch + 1);
  }

  async function commit() {
    if (committing || !dirtyRef.current) return;

    setCommitting(true);
    try {
      const newBaseSha = await courseOps.updateTopic(learningSession.topic, contentRef.current, undefined, baseShaRef.current);
      if (newBaseSha) baseShaRef.current = newBaseSha;
      setCommittedContent(contentRef.current);
      setDirty(false);
    } catch (error) {
      if (error?.code === 'github-conflict') {
        const reload = await showConfirm({
          title: 'Topic changed on the server',
          message: 'This topic was changed and committed from somewhere else since you opened it, so your changes were NOT saved. Reload the latest version? This replaces your unsaved edits — copy them first if you need them.',
          confirmButtonText: 'Reload latest',
          cancelButtonText: 'Keep editing',
          danger: true,
        });
        if (reload) await loadLatest();
      } else {
        showAlert({ message: 'Failed to commit changes. Please try again.', type: 'error' });
      }
    } finally {
      setCommitting(false);
    }
  }

  async function discard() {
    await loadLatest();
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

    // Entering edit mode loads the LATEST content from HEAD (not the per-session read snapshot), so an
    // edit never starts from a commit another machine has already superseded. Guard against
    // out-of-order resolution if the topic changes while the fetch is in flight.
    let cancelled = false;
    const topic = learningSession.topic;
    (async () => {
      if (topic?.type === 'embedded' || topic?.type === 'video') {
        if (cancelled) return;
        baseShaRef.current = null;
        setContentExternal(topic.path || '');
        setCommittedContent(topic.path || '');
      } else {
        const { content: latest, baseSha } = await courseOps.getTopicForEdit(topic);
        if (cancelled) return;
        baseShaRef.current = baseSha;
        setContentExternal(latest || '');
        setCommittedContent(latest || '');
      }
      onTopicLoaded?.();
      setDirty(false);
    })();
    return () => {
      cancelled = true;
    };
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
