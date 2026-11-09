import React from 'react';
import PropTypes from 'prop-types';

export default function GlobalSearch({ placeholder, value, onChange, onSearch }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className="relative rounded-md shadow-sm w-full max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-brand-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="focus:ring-brand-blue-500 focus:border-brand-blue-500 block w-full pl-9 pr-3 py-1.5 sm:text-sm border-brand-slate-200 rounded-md placeholder-brand-slate-400"
        placeholder={placeholder}
      />
    </div>
  );
}

GlobalSearch.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func,
};

GlobalSearch.defaultProps = {
  placeholder: 'Search...',
  onSearch: null,
};
