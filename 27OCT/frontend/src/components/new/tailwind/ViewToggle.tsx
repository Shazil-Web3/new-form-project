import React from 'react';
import PropTypes from 'prop-types';

export default function ViewToggle({ currentView, onViewChange }) {
  return (
    <div className="flex bg-surface-container-highest rounded-lg p-1 select-none">
      <button
        onClick={() => onViewChange('blocks')}
        className={`p-1 rounded flex items-center justify-center transition-all ${
          currentView === 'blocks'
            ? 'bg-surface-container-lowest shadow-sm text-primary'
            : 'text-on-surface-variant hover:text-on-surface'
        }`}
        title="Grid View"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>grid_view</span>
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={`p-1 rounded flex items-center justify-center transition-all ${
          currentView === 'list'
            ? 'bg-surface-container-lowest shadow-sm text-primary'
            : 'text-on-surface-variant hover:text-on-surface'
        }`}
        title="List View"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>view_list</span>
      </button>
    </div>
  );
}

ViewToggle.propTypes = {
  currentView: PropTypes.oneOf(['blocks', 'list']).isRequired,
  onViewChange: PropTypes.func.isRequired,
};
