import React, { useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../../api/apiClient';

export default function EmptyState({ title, description, searchActive, searchVal, activeTab, onClearSearch }) {
  const [healing, setHealing] = useState(false);
  const displayTitle = title || (searchActive ? `No results found for "${searchVal || ''}"` : `No items in ${activeTab || 'this section'}`);
  const displayDesc = description || (searchActive
    ? `We couldn't find anything matching your search in "${activeTab || 'the active tab'}". Try searching with a different keyword or clear your search.`
    : `There are currently no records available in this section.`);

  const handleInitialize = async () => {
    try {
      setHealing(true);
      if ('caches' in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        } catch (_) {}
      }
      try {
        localStorage.removeItem('mock_user_override');
      } catch (_) {}
      await apiClient.post('/api/system/auto-heal-workspace');
      window.location.reload();
    } catch (err) {
      console.error('Initialization error:', err);
      window.location.reload();
    }
  };

  return (
    <div className="text-center py-12 px-4 sm:px-6 lg:px-8 border-2 border-dashed border-outline-variant/60 rounded-xl bg-surface-container-low/40">
      <span className="material-symbols-outlined mx-auto text-on-surface-variant/40 text-[40px] block mb-2">
        {searchActive ? 'search_off' : 'folder_open'}
      </span>
      <h3 className="mt-2 text-sm font-bold text-on-surface">{displayTitle}</h3>
      <p className="mt-1 text-xs text-on-surface-variant max-w-sm mx-auto">{displayDesc}</p>
      {searchActive && onClearSearch ? (
        <button
          onClick={onClearSearch}
          className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          Clear Search
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInitialize}
          disabled={healing}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
          title="Self-heal workspace: seeds starter templates, departments, and active sample documents"
        >
          <span className={`material-symbols-outlined text-[16px] ${healing ? 'animate-spin' : ''}`}>sync</span>
          <span>{healing ? 'Initializing Workspace...' : 'Initialize Workspace with Starter Data'}</span>
        </button>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  searchActive: PropTypes.bool,
  searchVal: PropTypes.string,
  activeTab: PropTypes.string,
  onClearSearch: PropTypes.func,
};

