/**
 * @file MultiSearchableSelect.jsx
 * @description Multi-select variant of SearchableSelect. Renders a floating panel
 *   with a search input and a scrollable checklist. Selected items are shown as
 *   chip-style tags below the trigger button.
 *
 * Props:
 *   values       {string[]}  — Array of selected values.
 *   onChange     {Function}  — Called with the new full array of selected values.
 *   options      {Array}     — Array of { value, label } objects.
 *   placeholder  {string}
 *   disabled     {boolean}
 *   className    {string}
 *   maxDisplay   {number}    — Maximum chips to show before "+N more" label (default 3).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

export default function MultiSearchableSelect({
  values = [],
  onChange,
  options = [],
  placeholder = 'Select options...',
  disabled = false,
  className = '',
  maxDisplay = 3,
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

  const selectedSet = new Set(values.map(String));

  const filtered = options.filter((opt) =>
    String(opt.label ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggle = useCallback((optValue) => {
    const strVal = String(optValue);
    if (selectedSet.has(strVal)) {
      onChange(values.filter(v => String(v) !== strVal));
    } else {
      onChange([...values, strVal]);
    }
  }, [values, onChange, selectedSet]);

  const remove = useCallback((optValue) => {
    onChange(values.filter(v => String(v) !== String(optValue)));
  }, [values, onChange]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  const selectedOptions = options.filter(o => selectedSet.has(String(o.value)));
  const visibleChips = selectedOptions.slice(0, maxDisplay);
  const hiddenCount = selectedOptions.length - maxDisplay;

  const triggerBase = `w-full min-h-[44px] px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl 
    focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm 
    flex items-center flex-wrap gap-1.5 transition-colors
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-700/50'}
    ${open ? 'ring-1 ring-blue-700 border-blue-700' : ''}
    ${className}`;

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <div
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        className={triggerBase}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-on-surface-variant/60 flex-1">{placeholder}</span>
        ) : (
          <>
            {visibleChips.map(opt => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 bg-blue-700/10 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-lg border border-blue-700/20"
              >
                <span className="truncate max-w-[120px]">{opt.label}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(opt.value); }}
                  className="text-blue-600 hover:text-blue-900 flex-shrink-0"
                  aria-label={`Remove ${opt.label}`}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="text-xs text-on-surface-variant/60 font-medium">+{hiddenCount} more</span>
            )}
          </>
        )}
        <span
          className={`material-symbols-outlined text-[18px] text-on-surface-variant/60 ml-auto flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </div>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-surface border border-outline-variant rounded-xl shadow-xl overflow-hidden animate-fade-in">
          {/* Search */}
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

          {/* Selected count banner */}
          {selectedOptions.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-700/5 border-b border-blue-700/10 text-xs text-blue-700 font-semibold">
              <span>{selectedOptions.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="underline hover:no-underline text-blue-600 text-xs"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Options */}
          <ul role="listbox" aria-multiselectable="true" className="max-h-52 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-outline-variant">
            {filtered.length > 0 ? (
              filtered.map(opt => {
                const isSelected = selectedSet.has(String(opt.value));
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors
                      ${isSelected
                        ? 'bg-blue-700/8 text-blue-700'
                        : 'text-on-surface hover:bg-surface-container-high'
                      }`}
                  >
                    {/* Checkbox indicator */}
                    <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors
                      ${isSelected ? 'bg-blue-700 border-blue-700' : 'border-outline-variant bg-surface-container-lowest'}`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-white text-[12px]">check</span>
                      )}
                    </span>
                    <span className="truncate flex-1">{opt.label}</span>
                    {opt.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/50 text-on-surface-variant/70 flex-shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-4 text-xs text-on-surface-variant/60 italic text-center">
                No options match "{search}"
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

MultiSearchableSelect.propTypes = {
  values: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
      badge: PropTypes.string,
    })
  ).isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  maxDisplay: PropTypes.number,
};
