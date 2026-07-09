import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function DraMobilePicker({
  id,
  value,
  valueLabel,
  valueIcon,
  groups,
  isOpen,
  onToggle,
  onClose,
  onSelect,
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
}) {
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className={className}>
      <button
        id={id}
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-md border border-blue-200 bg-white/95 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 ${buttonClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {valueIcon && <span className="shrink-0">{valueIcon}</span>}
          <span className="truncate">{valueLabel}</span>
        </span>
        <ChevronDown size={16} className={`ml-2 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className={`mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg ${menuClassName}`}>
          {groups.map((group, groupIndex) => (
            <div key={group.label || groupIndex} className={groupIndex > 0 ? 'mt-2 border-t border-gray-100 pt-2' : ''}>
              {group.label && <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group.label}</div>}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onSelect?.(item.value);
                      onClose?.();
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${item.className || (item.selected ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-50')}`}
                  >
                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.description && <span className={`block truncate text-xs ${item.descriptionClassName || 'text-gray-500'}`}>{item.description}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
