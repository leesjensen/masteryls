import React from 'react';

export default function useLatest(value) {
  const ref = React.useRef(value);
  ref.current = value;
  return ref;
}
