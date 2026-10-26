import React from 'react';
import { buttonClasses } from './styles.js';

// Shared button primitive. Encodes the canonical radius/padding/focus/disabled
// chrome; pick a `variant` (primary | secondary | danger | ghost) and `size`
// (sm | md). Any extra className is appended, so one-off layout tweaks (w-full,
// margins) still work.
const Button = React.forwardRef(function Button({ variant = 'primary', size = 'md', type = 'button', className = '', ...props }, ref) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />;
});

export default Button;
