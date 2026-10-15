import React from 'react';
import PropTypes from 'prop-types';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../../utils/authService';

/**
 * MainLayout - Unified Navigation Wrapper Component
 * 
 * Embeds Topbar and Sidebar, providing a persistent layout template:
 * - Docked sidebar menu on the left.
 * - Global title header on the top (hiding search input on secondary pages).
 * - Responsive children viewport content area.
 */
export default function MainLayout({
  children,
  searchVal = '',
  onSearchChange = null,
  showSearch = false,
  fullWidth = false,
  hideTopbar = false,
}) {
  const { user } = useAuth();

  return (
    <div className="bg-background text-on-background flex flex-col h-screen overflow-hidden font-body-md text-body-md">
      {/* Persistent top bar — a page can hide it (e.g. the dark Calendar/Gantt page, which
          has its own header and otherwise clashes with the admin chrome bar). */}
      {!hideTopbar ? (
        <Topbar
          title="ProDoc Admin"
          user={user}
          searchVal={searchVal}
          onSearchChange={onSearchChange}
          showSearch={showSearch}
        />
      ) : null}

      {/* Persistent layout body content container */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        <Sidebar activeRoute={window.location.pathname} />
        <main className={`flex-1 overflow-y-auto bg-surface ${fullWidth ? 'p-0' : 'p-gutter pb-24 md:pb-gutter'}`}>
          <div className={fullWidth ? 'w-full h-full' : 'max-w-container_max_width mx-auto'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  searchVal: PropTypes.string,
  onSearchChange: PropTypes.func,
  showSearch: PropTypes.bool,
  fullWidth: PropTypes.bool,
  hideTopbar: PropTypes.bool,
};
