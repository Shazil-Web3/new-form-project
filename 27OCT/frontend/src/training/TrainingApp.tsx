import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/authService';
import apiClient from '../api/apiClient';
import { TrainingContext } from './context';
import { trainingService, useTrainingState } from './store';

import Reports from './pages/admin/Reports';
import NumberingRules from './pages/admin/NumberingRules';
import RecordsTab from './pages/RecordsTab';
import B44Page from '../base44training/B44Page';
import B44AdminContent from '../base44training/pages/AdminContent';
import B44AdminClassLibrary from '../base44training/pages/AdminClassLibrary';
import B44AdminClassDetail from '../base44training/pages/AdminClassDetail';
import B44AdminMatrix from '../base44training/pages/AdminMatrix';
import B44AdminMatrixTable from '../base44training/pages/AdminMatrixTable';
import B44QuizBuilder from '../base44training/pages/QuizBuilder';
import B44ManagerTasks from '../base44training/pages/ManagerTasks';
import B44Dashboard from '../base44training/pages/Dashboard';
import B44MyTraining from '../base44training/pages/MyTraining';
import B44Electives from '../base44training/pages/Electives';
import B44TakeClass from '../base44training/pages/TakeClass';
import B44TakeQuiz from '../base44training/pages/TakeQuiz';
import B44ManagerAssign from '../base44training/pages/ManagerAssign';
import B44ManagerMonitor from '../base44training/pages/ManagerMonitor';
import B44AdminUsers from '../base44training/pages/AdminUsers';
import B44AdminAssignments from '../base44training/pages/AdminAssignments';

const NAV = {
  administrator: [
    { to: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { to: 'catalog', label: 'Content Catalog', icon: 'account_tree' },
    { to: 'library', label: 'Class Library', icon: 'local_library' },
    { to: 'users', label: 'Users & Roles', icon: 'group' },
    { to: 'assignments', label: 'Assignments', icon: 'event_available' },
    { to: 'tasks', label: 'Tasks', icon: 'checklist' },
    { to: 'matrix', label: 'Training Matrix', icon: 'grid_view' },
    { to: 'matrix-table', label: 'Matrix Table', icon: 'table_chart' },
    { to: 'reports', label: 'Reports', icon: 'assessment' },
    { to: 'records', label: 'Records', icon: 'badge' },
    { to: 'numbering', label: 'Numbering Rules', icon: 'tag' },
  ],
  manager: [
    { to: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { to: 'assign', label: 'Assign Training', icon: 'assignment_add' },
    { to: 'monitor', label: 'Monitor Progress', icon: 'bar_chart' },
    { to: 'tasks', label: 'Tasks', icon: 'checklist' },
    { to: 'reports', label: 'Reports', icon: 'assessment' },
    { to: 'records', label: 'Records', icon: 'badge' },
  ],
  employee: [
    { to: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { to: 'my-training', label: 'My Training', icon: 'menu_book' },
    { to: 'electives', label: 'Browse Electives', icon: 'explore' },
    { to: 'records', label: 'Records', icon: 'badge' },
  ],
};

// Instant client-side guess so the sidebar renders immediately; /api/training/me/role
// (source of truth, matches the server's role-guard middleware) overwrites it once it loads.
const roleFromSiteUser = (siteRole) => {
  if (siteRole === 'admin') return 'administrator';
  if (siteRole === 'project_manager') return 'manager';
  return 'employee';
};

function RoutesForRole({ role }) {
  if (role === 'administrator') {
    return (
      <Routes>
        <Route path="dashboard" element={<B44Page><B44Dashboard /></B44Page>} />
        <Route path="catalog" element={<B44Page><B44AdminContent /></B44Page>} />
        <Route path="library" element={<B44Page><B44AdminClassLibrary /></B44Page>} />
        <Route path="matrix" element={<B44Page><B44AdminMatrix /></B44Page>} />
        <Route path="matrix-table" element={<B44Page><B44AdminMatrixTable /></B44Page>} />
        <Route path="class/:classId" element={<B44Page><B44AdminClassDetail /></B44Page>} />
        <Route path="quiz/:classId" element={<B44Page><B44QuizBuilder /></B44Page>} />
        <Route path="users" element={<B44Page><B44AdminUsers /></B44Page>} />
        <Route path="assignments" element={<B44Page><B44AdminAssignments /></B44Page>} />
        <Route path="tasks" element={<B44Page><B44ManagerTasks /></B44Page>} />
        <Route path="reports" element={<Reports />} />
        <Route path="records" element={<RecordsTab />} />
        <Route path="numbering" element={<NumberingRules />} />
        <Route path="*" element={<Navigate to="/training/dashboard" replace />} />
      </Routes>
    );
  }
  if (role === 'manager') {
    return (
      <Routes>
        <Route path="dashboard" element={<B44Page><B44Dashboard /></B44Page>} />
        <Route path="assign" element={<B44Page><B44ManagerAssign /></B44Page>} />
        <Route path="monitor" element={<B44Page><B44ManagerMonitor /></B44Page>} />
        <Route path="tasks" element={<B44Page><B44ManagerTasks /></B44Page>} />
        <Route path="reports" element={<Reports />} />
        <Route path="records" element={<RecordsTab />} />
        <Route path="*" element={<Navigate to="/training/dashboard" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="dashboard" element={<B44Page><B44Dashboard /></B44Page>} />
      <Route path="my-training" element={<B44Page><B44MyTraining /></B44Page>} />
      <Route path="electives" element={<B44Page><B44Electives /></B44Page>} />
      <Route path="class/:classId" element={<B44Page><B44TakeClass /></B44Page>} />
      <Route path="quiz/:classId" element={<B44Page><B44TakeQuiz /></B44Page>} />
      <Route path="records" element={<RecordsTab />} />
      <Route path="*" element={<Navigate to="/training/dashboard" replace />} />
    </Routes>
  );
}

export default function TrainingApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useTrainingState();
  const [role, setRole] = useState(() => roleFromSiteUser((user?.role || '').toLowerCase()));
  const [ready, setReady] = useState(false);

  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      let resolvedRole = roleFromSiteUser((user?.role || '').toLowerCase());
      try {
        const { data } = await apiClient.get('/api/training/me/role');
        if (data?.role) resolvedRole = data.role;
      } catch (error) {
        // Fall back to the client-side guess if the endpoint is unreachable.
      }
      if (cancelled) return;
      setRole(resolvedRole);
      await trainingService.hydrate(resolvedRole, currentUserId);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, user?.role]);

  const persona = useMemo(
    () => ({
      id: currentUserId !== undefined && currentUserId !== null ? String(currentUserId) : currentUserId,
      name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'You',
      email: user?.email || '',
    }),
    [currentUserId, user]
  );

  const nav = NAV[role];
  const roleLabel = { administrator: 'Administrator', manager: 'Manager', employee: 'Student' }[role];

  return (
    <TrainingContext.Provider value={{ role, persona }}>
      <div className="flex h-screen bg-slate-50 text-slate-900 [&_a]:no-underline">
        <aside className="hidden w-64 flex-none flex-col bg-[#12122b] text-white md:flex">
          <div className="flex items-center gap-3 px-5 py-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
              <span className="material-symbols-outlined text-[22px]">school</span>
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold">Lumen Learn</div>
              <div className="text-xs text-slate-400">Training Management</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={`/training/${item.to}`}
                className={({ isActive }) =>
                  `flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                    isActive ? 'bg-violet-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/10 text-sm font-semibold uppercase">
                {persona.name.charAt(0)}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">{persona.name}</div>
                <div className="text-xs text-slate-400">{roleLabel}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-3 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to main site
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 md:hidden"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Main site
            </button>
            <button
              type="button"
              onClick={() => trainingService.hydrate(role, currentUserId)}
              className="hidden items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 md:flex"
              title="Refresh training data"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Refresh
            </button>
            <div className="ml-auto flex items-center gap-2" role="group" aria-label="Your training role">
              <span className="rounded-full bg-violet-700 px-3.5 py-1.5 text-xs font-semibold text-white">{roleLabel}</span>
            </div>
          </header>

          <nav className="flex flex-none gap-1 overflow-x-auto border-b border-slate-200 bg-[#12122b] px-3 py-2 md:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={`/training/${item.to}`}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? 'bg-violet-700 text-white' : 'text-slate-300'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <main className="flex-1 overflow-y-auto">
            {ready ? <RoutesForRole role={role} key={role} /> : null}
          </main>
        </div>
      </div>
    </TrainingContext.Provider>
  );
}
