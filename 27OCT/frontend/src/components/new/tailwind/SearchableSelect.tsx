/**
 * @file SearchableSelect.jsx
 * @description Reusable searchable dropdown that replaces native <select> for long option lists.
 *   Opens a floating panel with a filter input and scrollable list of options.
 * @dependencies react, prop-types
 * @author Codegen
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * SearchableSelect
 * 
 * @param {string}   value         - Currently selected value.
 * @param {Function} onChange      - Called with the selected value string.
 * @param {Array}    options       - Array of { value, label } objects.
 * @param {string}   placeholder   - Placeholder text when nothing is selected.
 * @param {boolean}  required      - HTML required attribute.
 * @param {string}   className     - Additional class names for the trigger button.
 * @param {boolean}  disabled      - Disables the control entirely.
 * @param {boolean}  resetOnSelect - If true, resets back to placeholder after selecting (useful for add-to-list patterns).
 */
export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select an option...',
  required = false,
  className = '',
  disabled = false,
  resetOnSelect = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-focus search input when panel opens
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const filtered = options.filter((opt) =>
    String(opt.label ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label;

  const handleSelect = useCallback((optValue) => {
    onChange(optValue);
    setOpen(false);
    setSearch('');
    if (resetOnSelect) onChange('');
  }, [onChange, resetOnSelect]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  const baseBtn = `w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl 
    focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm 
    flex items-center justify-between gap-2 transition-colors
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-700/50'}
    ${open ? 'ring-1 ring-blue-700 border-blue-700' : ''}
    ${className}`;

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={baseBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate text-sm ${selectedLabel ? 'text-on-surface font-medium' : 'text-on-surface-variant/60'}`}>
          {selectedLabel || placeholder}
        </span>
        <span
          className={`material-symbols-outlined text-[18px] text-on-surface-variant/60 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-surface border border-outline-variant rounded-xl shadow-xl overflow-hidden animate-fade-in">
          {/* Search Input */}
          <div className="p-2 border-b border-outline-variant/60 bg-surface-container-low">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant/50">
                search
              </span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to filter..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-700 text-on-surface placeholder-on-surface-variant/40"
              />
            </div>
          </div>

          {/* Options List */}
          <ul
            role="listbox"
            className="max-h-52 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-outline-variant"
          >
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={String(opt.value) === String(value)}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm transition-colors
                    ${String(opt.value) === String(value)
                      ? 'bg-blue-700/8 text-blue-700 font-semibold'
                      : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {String(opt.value) === String(value) && (
                    <span className="material-symbols-outlined text-[16px] text-blue-700 flex-shrink-0">check</span>
                  )}
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-xs text-on-surface-variant/60 italic text-center">
                No options match "{search}"
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Hidden native input for form validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          className="absolute inset-0 opacity-0 pointer-events-none w-full"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

SearchableSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), label: PropTypes.string })
  ).isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  resetOnSelect: PropTypes.bool,
};
