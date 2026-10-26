import React from 'react';
import { inputClasses } from './styles.js';

// Shared text-input primitive with the canonical border/focus chrome.
const Input = React.forwardRef(function Input({ className = '', size = 'md', type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={inputClasses({ size, className })} {...props} />;
});

export default Input;
