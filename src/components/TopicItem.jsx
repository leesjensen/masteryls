import React, { useState } from 'react';
import { TopicIcon } from './TopicIcon';
import TopicForm from './TopicForm';

function TopicItem({ courseOps, topic, currentTopic, changeTopic }) {
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmitForm(title, prompt, type) {
    setIsLoading(true);
    try {
      await courseOps.generateTopic(topic, prompt);
      setShowForm(false);
    } catch (error) {
      console.error('Error adding topic:', error);
      // Keep form open on error so user can retry
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <li className="mb-0.5 flex justify-between items-center group">
      <div className="flex flex-col">
        <div className="flex flex-row">
          {topic.state && topic.state !== 'stable' && (
            <span onClick={() => setShowForm(true)} className="text-xs text-white bg-gray-500 rounded px-1 mr-1" title={`This topic is in "${topic.state}" state`}>
              {topic.state}
            </span>
          )}
          <span className="mr-2">
            <TopicIcon type={topic.type} />
          </span>
          <a onClick={() => changeTopic(topic)} className={`no-underline cursor-pointer truncate max-w-full block whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${topic.path === currentTopic?.path ? 'text-amber-500 font-semibold' : 'text-gray-500 hover:text-amber-500'}`} title={topic.title}>
            {topic.title}
          </a>
        </div>
        {showForm && <TopicForm title={topic.title} prompt={topic.description} type={topic.type} submitButtonText={'Generate'} onSubmit={handleSubmitForm} onCancel={() => setShowForm(false)} isLoading={isLoading} />}
      </div>
    </li>
  );
}

export default TopicItem;
