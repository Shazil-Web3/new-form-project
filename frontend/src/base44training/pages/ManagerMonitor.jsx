import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser, dueStatus, statusToneClasses, formatDate, daysUntil, addWeeks, toISODate, EXTENSION_WEEKS, MAX_EXTENSIONS } from '../lib/training';
import { Button } from '../components/ui/button';
import { BarChart3, Clock, CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { TeamStatusDonut, EmployeeCompletionChart } from '../components/TeamCharts';
import ManagerSummaryDashboard from '../components/ManagerSummaryDashboard';

export default function ManagerMonitor() {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState({}); // { assignmentId: { completed, total, pct } }
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const employees = await base44.entities.User.filter({ manager_id: me.id });
      setTeam(employees);
      const empIds = employees.map((e) => e.id);
      const allAssign = await base44.entities.Assignment.list('-created_date', 300);
      const teamAssign = allAssign.filter((a) => empIds.includes(a.employee_id));
      setAssignments(teamAssign);

      // compute progress per assignment
      const allClasses = await base44.entities.Class.list();
      const allProgress = await base44.entities.ClassProgress.list('-updated_date', 500);
      const progMap = {};
      for (const a of teamAssign) {
        const classes = allClasses.filter((c) => c.curriculum_id === a.curriculum_id);
        const total = classes.length;
        const empProgress = allProgress.filter((p) => p.employee_id === a.employee_id && classes.some((c) => c.id === p.class_id) && p.status === 'completed');
        const completed = empProgress.length;
        progMap[a.id] = { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 };
        // auto-complete assignment if all done
        if (total > 0 && completed === total && a.status !== 'completed') {
          await base44.entities.Assignment.update(a.id, { status: 'completed' });
        }
      }
      setProgress(progMap);
      setLoading(false);
    })();
  }, []);

  async function extendDueDate(a) {
    if (a.extensions_used >= MAX_EXTENSIONS) return;
    const newDate = toISODate(addWeeks(a.due_date, EXTENSION_WEEKS));
    await base44.entities.Assignment.update(a.id, { due_date: newDate, extensions_used: a.extensions_used + 1 });
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, due_date: newDate, extensions_used: x.extensions_used + 1 } : x)));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'manager' && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  // group assignments by employee
  const byEmployee = {};
  for (const a of assignments) {
    if (!byEmployee[a.employee_id]) byEmployee[a.employee_id] = { employee: team.find((e) => e.id === a.employee_id), items: [] };
    byEmployee[a.employee_id].items.push(a);
  }

  // chart data: status distribution
  let completed = 0, inProgress = 0, assignedCount = 0, overdueCount = 0;
  for (const a of assignments) {
    if (a.status === 'completed') { completed++; continue; }
    const ds = dueStatus(a.due_date, a.status);
    if (ds.tone === 'red') { overdueCount++; continue; }
    if (a.status === 'in_progress') inProgress++;
    else assignedCount++;
  }
  const statusData = [
    { name: 'Completed', value: completed },
    { name: 'In Progress', value: inProgress },
    { name: 'Assigned', value: assignedCount },
    { name: 'Overdue', value: overdueCount },
  ];

  // chart data: per-employee completion
  const employeeData = Object.entries(byEmployee).map(([empId, group]) => {
    const items = group.items.map((a) => progress[a.id] || { completed: 0, total: 0, pct: 0 });
    const totalCompleted = items.reduce((sum, p) => sum + p.completed, 0);
    const totalClasses = items.reduce((sum, p) => sum + p.total, 0);
    const pct = totalClasses > 0 ? Math.round((totalCompleted / totalClasses) * 100) : 0;
    const name = group.employee?.full_name?.split(' ')[0] || group.employee?.email?.split('@')[0] || 'User';
    return { name, pct };
  });

  // summary dashboard: overall stats + falling-behind employees (required only)
  const allProg = Object.values(progress);
  const totalCompletedClasses = allProg.reduce((sum, p) => sum + p.completed, 0);
  const totalClassesAcross = allProg.reduce((sum, p) => sum + p.total, 0);
  const overallPct = totalClassesAcross > 0 ? Math.round((totalCompletedClasses / totalClassesAcross) * 100) : 0;
  const overdueRequired = assignments.filter((a) => a.assignment_type === 'required' && a.status !== 'completed' && dueStatus(a.due_date, a.status).tone === 'red').length;

  const fallingBehind = Object.entries(byEmployee)
    .map(([empId, group]) => {
      const requiredItems = group.items
        .filter((a) => a.assignment_type === 'required' && a.status !== 'completed')
        .map((a) => {
          const ds = dueStatus(a.due_date, a.status);
          return { name: a.curriculum_name, due_date: a.due_date, label: ds.label, tone: ds.tone };
        })
        .filter((item) => item.tone === 'red' || item.tone === 'amber');
      if (requiredItems.length === 0) return null;
      const items = group.items.map((a) => progress[a.id] || { completed: 0, total: 0, pct: 0 });
      const tc = items.reduce((sum, p) => sum + p.completed, 0);
      const tt = items.reduce((sum, p) => sum + p.total, 0);
      const completionPct = tt > 0 ? Math.round((tc / tt) * 100) : 0;
      return {
        id: empId,
        name: group.employee?.full_name,
        email: group.employee?.email,
        overdueCount: requiredItems.filter((i) => i.tone === 'red').length,
        atRiskCount: requiredItems.filter((i) => i.tone === 'amber').length,
        items: requiredItems,
        completionPct,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.overdueCount - a.overdueCount || b.atRiskCount - a.atRiskCount);

  const atRiskEmployees = new Set(fallingBehind.filter((e) => e.atRiskCount > 0 && e.overdueCount === 0).map((e) => e.id));
  const overdueEmployees = new Set(fallingBehind.filter((e) => e.overdueCount > 0).map((e) => e.id));
  const summaryStats = {
    overallPct,
    completedClasses: totalCompletedClasses,
    totalClasses: totalClassesAcross,
    totalEmployees: Object.keys(byEmployee).length,
    onTrack: Object.keys(byEmployee).length - fallingBehind.length,
    atRisk: atRiskEmployees.size,
    overdueRequired,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Monitor Progress</h1>
        <p className="text-sm text-slate-500">Track your team's training completion and due dates.</p>
      </div>

      {assignments.length > 0 && (
        <>
          <ManagerSummaryDashboard stats={summaryStats} fallingBehind={fallingBehind} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TeamStatusDonut data={statusData} />
            <EmployeeCompletionChart data={employeeData} />
          </div>
        </>
      )}

      {Object.keys(byEmployee).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">No training assignments to monitor yet.</p>
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
                  <p className="text-xs text-slate-500">{group.items.length} assignment{group.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {group.items.map((a) => {
                  const ds = dueStatus(a.due_date, a.status);
                  const prog = progress[a.id] || { completed: 0, total: 0, pct: 0 };
                  const canExtend = a.assignment_type === 'elective' && a.status !== 'completed' && a.extensions_used < MAX_EXTENSIONS;
                  return (
                    <div key={a.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{a.curriculum_name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {a.assignment_type === 'required' ? 'Required' : 'Elective'} · Due {formatDate(a.due_date)}
                            {a.extensions_used > 0 && ` · Extended ${a.extensions_used}×`}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneClasses(ds.tone)}`}>{ds.label}</span>
                      </div>
                      {prog.total > 0 && (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{prog.completed} of {prog.total} classes completed</span>
                            <span className="font-medium text-slate-700">{prog.pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all ${prog.pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${prog.pct}%` }} />
                          </div>
                        </div>
                      )}
                      {canExtend && (
                        <button onClick={() => extendDueDate(a)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                          <RefreshCw className="h-3.5 w-3.5" /> Extend due date ({MAX_EXTENSIONS - a.extensions_used} left)
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