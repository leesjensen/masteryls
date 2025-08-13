import React from 'react';
import Instruction from './instruction';

export default function Schedule({ config }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-xs">
      <Instruction config={config} topicUrl={config.schedule} />
    </div>
  );
}
