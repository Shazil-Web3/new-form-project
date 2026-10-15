import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser, dueStatus, statusToneClasses, formatDate, addWeeks, toISODate, EXTENSION_WEEKS, MAX_EXTENSIONS } from '../lib/training';
import { Button } from '../components/ui/button';
import { CalendarClock, RefreshCw, Users, Inbox } from 'lucide-react';

export default function AdminAssignments() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const [allUsers, allAssign, allClasses, allProgress] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Assignment.list('-created_date', 500),
        base44.entities.Class.list(),
        base44.entities.ClassProgress.list('-updated_date', 500),
      ]);
      setUsers(allUsers);
      setAssignments(allAssign);
      const progMap = {};
      for (const a of allAssign) {
        const classes = allClasses.filter((c) => c.curriculum_id === a.curriculum_id && (!a.class_id || c.id === a.class_id));
        const total = a.class_id ? 1 : classes.length;
        const completed = a.class_id
          ? allProgress.filter((p) => p.employee_id === a.employee_id && p.class_id === a.class_id && p.status === 'completed').length
          : allProgress.filter((p) => p.employee_id === a.employee_id && classes.some((c) => c.id === p.class_id) && p.status === 'completed').length;
        progMap[a.id] = { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 };
      }
      setProgress(progMap);
      setLoading(false);
    })();
  }, []);

  async function extendDueDate(a) {
    if (a.assignment_type === 'elective' && a.extensions_used >= MAX_EXTENSIONS) return;
    const newDate = toISODate(addWeeks(a.due_date, EXTENSION_WEEKS));
    await base44.entities.Assignment.update(a.id, { due_date: newDate, extensions_used: a.extensions_used + 1 });
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, due_date: newDate, extensions_used: x.extensions_used + 1 } : x)));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  const byEmployee = {};
  for (const a of assignments) {
    if (!byEmployee[a.employee_id]) byEmployee[a.employee_id] = { employee: users.find((u) => u.id === a.employee_id), items: [] };
    byEmployee[a.employee_id].items.push(a);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Assignments</h1>
        <p className="text-sm text-slate-500">View all training assignments across the organization and extend due dates as needed.</p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">No assignments have been created yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byEmployee).map(([empId, group]) => (
            <div key={empId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {(group.employee?.full_name || group.employee?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{group.employee?.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-slate-500">{group.employee?.email}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {group.items.map((a) => {
                  const ds = dueStatus(a.due_date, a.status);
                  const prog = progress[a.id] || { completed: 0, total: 0, pct: 0 };
                  const isElective = a.assignment_type === 'elective';
                  const canExtend = a.status !== 'completed' && (!isElective || a.extensions_used < MAX_EXTENSIONS);
                  return (
                    <div key={a.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {a.class_name ? a.class_name : a.curriculum_name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className={isElective ? 'text-violet-600' : 'text-indigo-600'}>{isElective ? 'Elective' : 'Required'}</span>
                            {' · '}Due {formatDate(a.due_date)}
                            {a.extensions_used > 0 && ` · Extended ${a.extensions_used}×`}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneClasses(ds.tone)}`}>{ds.label}</span>
                      </div>
                      {prog.total > 0 && (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{prog.completed} of {prog.total} completed</span>
                            <span className="font-medium text-slate-700">{prog.pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all ${prog.pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${prog.pct}%` }} />
                          </div>
                        </div>
                      )}
                      {canExtend && (
                        <button onClick={() => extendDueDate(a)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {isElective ? `Extend due date (${MAX_EXTENSIONS - a.extensions_used} left)` : 'Extend due date (admin override)'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}