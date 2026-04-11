import React from 'react';
import { getTopicDisplayLabel } from './topicLinkUtils';

const TopicLinkDialog = React.forwardRef(function TopicLinkDialog(_, ref) {
  const [topics, setTopics] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [selectedTopicId, setSelectedTopicId] = React.useState('');
  const dialogRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const resolverRef = React.useRef(null);

  const filteredTopics = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return topics;
    }

    return topics.filter((topic) => {
      const title = String(topic.title || '').toLowerCase();
      const description = String(topic.description || '').toLowerCase();
      const path = String(topic.path || '').toLowerCase();
      return title.includes(search) || description.includes(search) || path.includes(search);
    });
  }, [topics, query]);

  const closeDialog = React.useCallback((selectedTopic = null) => {
    dialogRef.current?.close();
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) {
      resolve(selectedTopic);
    }
  }, []);

  const confirmSelection = React.useCallback(() => {
    const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) || filteredTopics[0] || null;
    closeDialog(selectedTopic);
  }, [closeDialog, filteredTopics, selectedTopicId, topics]);

  React.useImperativeHandle(
    ref,
    () => ({
      show: ({ topics: nextTopics = [] } = {}) => {
        return new Promise((resolve) => {
          resolverRef.current = resolve;
          setTopics(nextTopics);
          setQuery('');
          setSelectedTopicId(nextTopics[0]?.id || '');
          dialogRef.current?.showModal();
          setTimeout(() => searchInputRef.current?.focus(), 0);
        });
      },
    }),
    [],
  );

  React.useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(null);
        resolverRef.current = null;
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="w-full p-6 rounded-lg shadow-xl max-w-3xl mt-20 mx-auto"
      onCancel={(e) => {
        e.preventDefault();
        closeDialog(null);
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Insert topic link</h3>
          <p className="text-xs text-gray-500">Select a topic to insert a course link.</p>
        </div>
        <button type="button" onClick={() => closeDialog(null)} className="text-sm text-gray-500 hover:text-gray-700">
          Close
        </button>
      </div>

      <input ref={searchInputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics by title, description, or path" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />

      <div className="mt-3 border border-gray-200 rounded-lg max-h-80 overflow-y-auto bg-white">
        {filteredTopics.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {filteredTopics.map((topic) => {
              const isSelected = selectedTopicId === topic.id;
              const label = getTopicDisplayLabel(topic);
              return (
                <li key={topic.id}>
                  <button type="button" onClick={() => setSelectedTopicId(topic.id)} onDoubleClick={confirmSelection} className={`w-full text-left px-3 py-2 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <div className="text-sm text-gray-800">{label}</div>
                    {topic.path && <div className="text-xs text-gray-500 mt-1">{topic.path}</div>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-4 text-sm text-gray-500">No topics match your search.</div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={() => closeDialog(null)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={confirmSelection} disabled={!selectedTopicId && filteredTopics.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
          Insert link
        </button>
      </div>
    </dialog>
  );
});

export default TopicLinkDialog;
