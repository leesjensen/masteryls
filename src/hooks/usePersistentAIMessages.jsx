import { useCallback, useEffect, useMemo } from 'react';

export default function usePersistentAIMessages(topicId, aiMessages, setAIMessages) {
  const aiStorageKey = useMemo(() => `discussion-ai-messages-${topicId || 'global'}`, [topicId]);

  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(aiStorageKey);
      if (!savedMessages) {
        setAIMessages([]);
        return;
      }

      const parsedMessages = JSON.parse(savedMessages);
      setAIMessages(Array.isArray(parsedMessages) ? parsedMessages : []);
    } catch {
      setAIMessages([]);
    }
  }, [aiStorageKey, setAIMessages]);

  useEffect(() => {
    localStorage.setItem(aiStorageKey, JSON.stringify(aiMessages || []));
  }, [aiMessages, aiStorageKey]);

  const clearStoredAIMessages = useCallback(() => {
    localStorage.removeItem(aiStorageKey);
  }, [aiStorageKey]);

  return { clearStoredAIMessages };
}
