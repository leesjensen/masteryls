import React from 'react';
import { selectClasses } from './styles.js';

// Shared select primitive with the canonical border/focus chrome.
const Select = React.forwardRef(function Select({ className = '', size = 'md', children, ...props }, ref) {
  return (
    <select ref={ref} className={selectClasses({ size, className })} {...props}>
      {children}
    </select>
  );
});

export default Select;
