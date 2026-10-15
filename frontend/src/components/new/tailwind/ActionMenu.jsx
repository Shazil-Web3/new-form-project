import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function ActionMenu({ actions, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (disabled) {
    return (
      <button disabled className="text-brand-slate-300 cursor-not-allowed p-1">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
    );
  }

  const activeActions = actions.filter((a) => !a.hidden);
  if (activeActions.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-brand-slate-500 hover:text-brand-slate-800 p-1.5 rounded-full hover:bg-brand-slate-100 transition-all focus:outline-none"
        type="button"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-1 w-44 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 focus:outline-none">
          <div className="py-1">
            {activeActions.map((action, idx) => (
              <button
                key={idx}
                disabled={action.disabled}
                onClick={() => {
                  setIsOpen(false);
                  if (action.onClick) action.onClick();
                }}
                className={`w-full text-left px-4 py-2 text-xs flex items-center transition-all ${
                  action.disabled
                    ? 'text-brand-slate-300 cursor-not-allowed bg-brand-slate-50'
                    : action.danger
                    ? 'text-brand-red-500 hover:bg-brand-red-50'
                    : 'text-brand-slate-700 hover:bg-brand-slate-50 hover:text-brand-slate-900'
                }`}
              >
                {action.icon && <span className="mr-2 text-sm">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ActionMenu.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
      disabled: PropTypes.bool,
      danger: PropTypes.bool,
      icon: PropTypes.node,
      hidden: PropTypes.bool,
    })
  ).isRequired,
  disabled: PropTypes.bool,
};

ActionMenu.defaultProps = {
  disabled: false,
};
