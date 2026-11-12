/**
 * @file Topbar.jsx
 * @description Persistent top header navigation containing global search, logo, and mock user switcher dropdown
 * @dependencies react, prop-types, useAuth
 * @author Codegen
 */

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../../utils/authService';
import apiClient from '../../../api/apiClient';

export default function Topbar({ title, user, onMenuToggle, searchVal, onSearchChange, showSearch = true }) {
  const isDev = process.env.NODE_ENV === 'development';
  const { mockUserOverride, setMockUserOverride } = useAuth();
  const [orgUsers, setOrgUsers] = useState([]);
  const [matrixRevision, setMatrixRevision] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setMatrixRevision(v => v + 1);
    window.addEventListener('watermelon_rbac_matrix_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('watermelon_rbac_matrix_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isDev) return;
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const res = await apiClient.get('/api/users');
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        if (isMounted) {
          setOrgUsers(list);
        }
      } catch (err) {
        console.warn('Could not fetch org users for Permissions Actor dropdown:', err);
      }
    };
    fetchUsers();
    return () => { isMounted = false; };
  }, [isDev]);

  // Format dynamic actor options from DB and storage
  const actorOptions = useMemo(() => {
    if (!isDev) return [];

    let userAssignments = {};
    let customRoles = [];
    try {
      userAssignments = JSON.parse(window.localStorage.getItem('watermelon_rbac_user_assignments_v1') || '{}');
      const allRoles = JSON.parse(window.localStorage.getItem('watermelon_rbac_roles_v5') || '[]');
      customRoles = allRoles.filter(r => !r.is_system);
    } catch (e) {}

    const userOptions = orgUsers.map(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
      let roleName = u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Member';

      const customAssign = userAssignments[u.id];
      if (customAssign?.roleId) {
        const foundRole = customRoles.find(r => String(r.id) === String(customAssign.roleId));
        if (foundRole) {
          roleName = foundRole.label || foundRole.name;
        }
      }

      return {
        label: `${roleName}: ${fullName} (${u.email})`,
        value: String(u.id),
        user: {
          id: u.id,
          userId: u.id,
          name: fullName,
          firstName: u.first_name || '',
          lastName: u.last_name || '',
          username: (u.email || '').split('@')[0],
          role: u.role || 'viewer',
          department: u.department || null,
          email: u.email,
          organization_id: u.organization_id || u.orgId || u.org_id,
          template_approver: u.template_approver || 'no',
          is_super_admin: Boolean(u.is_super_admin || u.isSuperAdmin || u.role === 'super_admin'),
          isSuperAdmin: Boolean(u.is_super_admin || u.isSuperAdmin || u.role === 'super_admin')
        }
      };
    });

    const customRoleOptions = customRoles.map(cr => ({
      label: `🎭 Custom Role: ${cr.label || cr.name}`,
      value: `custom_role_${cr.id}`,
      user: {
        id: `custom_actor_${cr.id}`,
        userId: `custom_actor_${cr.id}`,
        name: `${cr.label || cr.name} (Custom Persona)`,
        firstName: cr.label || cr.name,
        lastName: 'Persona',
        role: cr.key || cr.id,
        customRoleId: cr.id,
        department: 'Quality Assurance',
        email: `${(cr.key || 'custom').toLowerCase()}@watermelon.local`,
        is_super_admin: false,
        isSuperAdmin: false
      }
    }));

    return [
      { label: 'Real User (Admin)', value: 'real_user', user: null },
      ...userOptions,
      ...customRoleOptions
    ];
  }, [isDev, orgUsers, matrixRevision]);

  const currentSelectedValue = (isDev && mockUserOverride)
    ? (mockUserOverride.customRoleId ? `custom_role_${mockUserOverride.customRoleId}` : String(mockUserOverride.id))
    : 'real_user';

  const handleRoleChange = (e) => {
    if (!isDev) return;
    const val = e.target.value;
    if (val === 'real_user') {
      setMockUserOverride(null);
    } else {
      const match = actorOptions.find(opt => opt.value === val);
      if (match) {
        setMockUserOverride(match.user);
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('watermelon_rbac_matrix_changed'));
    } catch (err) {}
  };

  return (
    <header className="flex justify-between items-center h-[60px] w-full px-gutter bg-surface-container-lowest border-b border-blue-700 border-outline-variant shadow-sm z-30 flex-shrink-0 select-none">
      {/* Left items: menu toggle and relocated Logo + App name from Sidebar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-on-surface-variant flex items-center justify-center p-1 rounded hover:bg-surface-container-high transition-colors"
          title="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-700 text-white flex items-center justify-center font-bold shadow-sm">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>description</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-extrabold text-blue-600 leading-none tracking-tight">ProDoc Admin Hub</h1>
            <span className="text-[9px] font-bold text-on-surface-variant leading-none mt-0.5">Enterprise Tier</span>
          </div>
        </div>
      </div>

      {/* Middle items: global app-wide quick search input formatted to match theme */}
      {showSearch && (
        <div className="flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <span className="text-slate-700 material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">
              search
            </span>
            <input
              className="border-blue-700 w-full pl-10 pr-4 py-2 border border-outline-variant rounded-full bg-surface-container-low text-on-surface text-xs font-semibold placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm hover:border-outline-variant"
              placeholder="Search documents, templates, categories..."
              type="text"
              value={searchVal || ''}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Right items: mock switcher (development only) and user profile avatar status */}
      <div className="flex items-center gap-4">
        
        {/* Development Permissions Simulator switcher pill */}
        {isDev && user && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-1 text-xs shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-amber-700 flex items-center">shield_person</span>
            <span className="font-bold hidden sm:inline">Permissions Actor:</span>
            <select
              value={currentSelectedValue}
              onChange={handleRoleChange}
              className="bg-transparent font-extrabold border-none outline-none cursor-pointer focus:ring-0 text-xs py-0 pl-0.5 pr-5 max-w-[240px] truncate"
            >
              {actorOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="text-on-surface bg-surface text-xs font-semibold">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {user && (
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs font-semibold text-on-surface-variant">
              {user.name || 'User'}
            </span>
            <div className="w-8 h-8 rounded-full bg-secondary-container overflow-hidden border border-outline-variant flex-shrink-0">
              {user.imageUrl ? (
                <img alt={`${user.name || 'User'} profile avatar`} className="w-full h-full object-cover" src={user.imageUrl} />
              ) : (
                <div className="w-full h-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-bold text-xs">
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

Topbar.propTypes = {
  title: PropTypes.string,
  user: PropTypes.shape({
    name: PropTypes.string,
    imageUrl: PropTypes.string,
  }),
  onMenuToggle: PropTypes.func,
  searchVal: PropTypes.string,
  onSearchChange: PropTypes.func,
};

Topbar.defaultProps = {
  title: 'ProDoc Admin Hub',
  user: null,
  onMenuToggle: () => { },
  searchVal: '',
  onSearchChange: () => { },
};
