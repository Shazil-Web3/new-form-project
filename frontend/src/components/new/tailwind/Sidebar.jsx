/**
 * @file Sidebar.jsx
 * @description Collapsible hover side menu navigation block aligned underneath the top app bar
 * @dependencies react, prop-types, react-router-dom
 * @author Codegen
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../utils/authService';

export default function Sidebar({ activeRoute }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const userRole = (user?.role || 'viewer').toLowerCase();

  const allMenuItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: 'dashboard',
    },
    {
      name: 'My Tasks',
      path: '/workspace/tasks',
      icon: 'task',
    },
    {
      name: 'Hub',
      path: '/workspace',
      icon: 'work',
    },
    {
      name: 'Calendar',
      path: '/calendar',
      icon: 'calendar_today',
    },
    {
      name: 'Account Management',
      path: '/workspace/account-management',
      icon: 'person',
      allowedRoles: ['admin', 'project_manager'],
    },
    {
      name: 'References',
      path: '/references',
      icon: 'library_books',
    },
    {
      name: 'Audit Trail',
      path: '/workspace/audit-trail',
      icon: 'history',
      allowedRoles: ['admin', 'project_manager'],
    },
    {
      name: 'Trending',
      path: '/workspace/trending',
      icon: 'trending_up',
    },
    {
      name: 'Training',
      path: '/training',
      icon: 'school',
      matchPrefix: true,
    },
  ];

  const menuItems = allMenuItems.filter((item) => {
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(userRole);
  });

  return (
    <aside className="w-[70px] flex-shrink-0 relative h-full hidden md:block z-[800]">
      <nav
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`absolute top-0 bottom-0 left-0 flex flex-col bg-surface-container py-stack_md border-r border-outline-variant select-none transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-[260px] px-3 shadow-2xl z-[850]' : 'w-[70px] px-2 z-[800]'
        }`}
      >
        {/* Main Nav */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {menuItems.map((item, idx) => {
            const isSelected = item.matchPrefix ? activeRoute.startsWith(item.path) : activeRoute === item.path;
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center rounded-lg transition-all duration-200 ease-in-out font-label-sm text-label-sm h-10 ${
                  isExpanded ? 'px-3 justify-start' : 'justify-center px-0'
                } ${
                  isSelected
                    ? 'bg-secondary-fixed text-primary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined flex-shrink-0">{item.icon}</span>
                <span
                  className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                    isExpanded ? 'opacity-100 max-w-[180px] ml-3' : 'opacity-0 max-w-0 ml-0'
                  }`}
                >
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className={`mt-auto space-y-1 pt-4 border-t border-outline-variant ${isExpanded ? '' : 'flex flex-col items-center'}`}>
          <button
            onClick={() => navigate('/published-docs')}
            className={`w-full flex items-center rounded-lg transition-all duration-200 ease-in-out font-label-sm text-label-sm h-10 ${
              isExpanded ? 'px-3 justify-start' : 'justify-center px-0'
            } ${
              activeRoute === '/published-docs'
                ? 'bg-secondary-fixed text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined flex-shrink-0">check_circle</span>
            <span
              className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                isExpanded ? 'opacity-100 max-w-[180px] ml-3' : 'opacity-0 max-w-0 ml-0'
              }`}
            >
              Published Docs
            </span>
          </button>
          <button
            onClick={() => navigate('/repository')}
            className={`w-full flex items-center rounded-lg transition-all duration-200 ease-in-out font-label-sm text-label-sm h-10 ${
              isExpanded ? 'px-3 justify-start' : 'justify-center px-0'
            } ${
              activeRoute === '/repository'
                ? 'bg-secondary-fixed text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined flex-shrink-0">folder</span>
            <span
              className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                isExpanded ? 'opacity-100 max-w-[180px] ml-3' : 'opacity-0 max-w-0 ml-0'
              }`}
            >
              Repository
            </span>
          </button>
          <button
            onClick={() => navigate('/support')}
            className={`w-full flex items-center rounded-lg transition-all duration-200 ease-in-out font-label-sm text-label-sm h-10 ${
              isExpanded ? 'px-3 justify-start' : 'justify-center px-0'
            } ${
              activeRoute === '/support'
                ? 'bg-secondary-fixed text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined flex-shrink-0">help</span>
            <span
              className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                isExpanded ? 'opacity-100 max-w-[180px] ml-3' : 'opacity-0 max-w-0 ml-0'
              }`}
            >
              Support
            </span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center rounded-lg transition-all duration-200 ease-in-out font-label-sm text-label-sm h-10 ${
              isExpanded ? 'px-3 justify-start' : 'justify-center px-0'
            } ${
              activeRoute === '/settings'
                ? 'bg-secondary-fixed text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined flex-shrink-0">settings</span>
            <span
              className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                isExpanded ? 'opacity-100 max-w-[180px] ml-3' : 'opacity-0 max-w-0 ml-0'
              }`}
            >
              Settings
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

Sidebar.propTypes = {
  activeRoute: PropTypes.string.isRequired,
};
