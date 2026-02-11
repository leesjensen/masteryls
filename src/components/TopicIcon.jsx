import React from 'react';
import { Video, Images, BookCheck, ClipboardCheck, File } from 'lucide-react';

export function TopicIcon({ type }) {
  switch (type) {
    case 'embedded':
      return <Images size={16} className="text-gray-600" />;
    case 'video':
      return <Video size={16} className="text-gray-600" />;
    case 'exam':
      return <BookCheck size={16} className="text-gray-600" />;
    case 'project':
      return <ClipboardCheck size={16} className="text-gray-600" />;
    default:
      return <File size={16} className="text-gray-600" />;
  }
}
