import React from 'react';
import { textareaClasses } from './styles.js';

// Shared textarea primitive with the canonical border/focus chrome.
const Textarea = React.forwardRef(function Textarea({ className = '', size = 'md', ...props }, ref) {
  return <textarea ref={ref} className={textareaClasses({ size, className })} {...props} />;
});

export default Textarea;
