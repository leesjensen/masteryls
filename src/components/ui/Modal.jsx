import React from 'react';

// Shared modal/dialog shell. Wraps a native <dialog> with the canonical
// surface chrome (radius, shadow, top offset, centering, padding) so every
// dialog looks the same. The backdrop scrim is set globally in index.css.
//
// Usage: render with a ref, then call ref.current.showModal() / .close().
//   const ref = useRef(null);
//   <Modal dialogRef={ref} title="Delete?"> ... </Modal>

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
  wide: 'max-w-6xl',
};

const Modal = React.forwardRef(function Modal({ dialogRef, title, titleClassName = 'text-xl font-bold text-blue-600 mb-4', size = 'md', className = '', children, onClose, ...props }, ref) {
  const resolvedRef = dialogRef || ref;
  const sizeClass = SIZES[size] || SIZES.md;
  return (
    <dialog ref={resolvedRef} onClose={onClose} onClick={(e) => e.stopPropagation()} className={`w-full ${sizeClass} mt-20 mx-auto p-6 rounded-lg shadow-lg ${className}`.trim()} {...props}>
      {title && <h2 className={titleClassName}>{title}</h2>}
      {children}
    </dialog>
  );
});

export default Modal;
