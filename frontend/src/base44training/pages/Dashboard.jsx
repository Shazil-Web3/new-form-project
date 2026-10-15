import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser, dueStatus, statusToneClasses, formatDate } from '../lib/training';
import { BookOpen, ClipboardList, FolderTree, Users, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone] || tones.slate}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { viewRole } = useOutletContext() || {};
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      if (!me) { setLoading(false); return; }

      const roleToUse = viewRole || me.role;
      if (roleToUse === 'admin') {
        const [specs, curs, classes, users] = await Promise.all([
          base44.entities.FieldSpecialty.list(),
          base44.entities.Curriculum.list(),
          base44.entities.Class.list(),
          base44.entities.User.list(),
        ]);
        setStats({
          specialties: specs.length,
          curriculums: curs.length,
          classes: classes.length,
          users: users.length,
        });
      } else if (roleToUse === 'manager') {
        const employees = await base44.entities.User.filter({ manager_id: me.id });
        setTeam(employees);
        const empIds = employees.map((e) => e.id);
        const allAssign = await base44.entities.Assignment.list('-created_date', 200);
        const teamAssign = allAssign.filter((a) => empIds.includes(a.employee_id));
        setAssignments(teamAssign);
        setStats({
          team: employees.length,
          active: teamAssign.filter((a) => a.status !== 'completed').length,
          overdue: teamAssign.filter((a) => dueStatus(a.due_date, a.status).tone === 'red').length,
          completed: teamAssign.filter((a) => a.status === 'completed').length,
        });
      } else {
        const myAssign = await base44.entities.Assignment.filter({ employee_id: me.id }, '-created_date', 100);
        setAssignments(myAssign);
        setStats({
          assigned: myAssign.filter((a) => a.status !== 'completed').length,
          inProgress: myAssign.filter((a) => a.status === 'in_progress').length,
          completed: myAssign.filter((a) => a.status === 'completed').length,
          overdue: myAssign.filter((a) => dueStatus(a.due_date, a.status).tone === 'red').length,
        });
      }
      setLoading(false);
    })();
  }, [viewRole]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  const activeRole = viewRole || user?.role;
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {activeRole === 'admin' && 'Manage your organization\'s training catalog and users.'}
          {activeRole === 'manager' && 'Assign and monitor training for your team.'}
          {activeRole === 'employee' && 'Track your assigned training and explore electives.'}
        </p>
      </div>

      {activeRole === 'admin' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={FolderTree} label="Field Specialties" value={stats.specialties ?? 0} tone="indigo" />
          <StatCard icon={BookOpen} label="Curriculums" value={stats.curriculums ?? 0} tone="emerald" />
          <StatCard icon={ClipboardList} label="Classes" value={stats.classes ?? 0} tone="amber" />
          <StatCard icon={Users} label="Users" value={stats.users ?? 0} tone="slate" />
        </div>
      )}

      {activeRole === 'manager' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="Team Members" value={stats.team ?? 0} tone="indigo" />
          <StatCard icon={Clock} label="Active Assignments" value={stats.active ?? 0} tone="amber" />
          <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue ?? 0} tone="rose" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed ?? 0} tone="emerald" />
        </div>
      )}

      {activeRole === 'employee' && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={ClipboardList} label="Assigned" value={stats.assigned ?? 0} tone="indigo" />
            <StatCard icon={Clock} label="In Progress" value={stats.inProgress ?? 0} tone="amber" />
            <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue ?? 0} tone="rose" />
            <StatCard icon={CheckCircle2} label="Completed" value={stats.completed ?? 0} tone="emerald" />
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your current training</h2>
              <Link to="/training/my-training" className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {assignments.filter((a) => a.status !== 'completed').length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-sm text-slate-500">You're all caught up — no pending training.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.filter((a) => a.status !== 'completed').slice(0, 4).map((a) => {
                  const ds = dueStatus(a.due_date, a.status);
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div>
                        <p className="font-medium text-slate-900">{a.curriculum_name}{a.class_name ? ` · ${a.class_name}` : ''}</p>
                        <p className="text-xs text-slate-500">Due {formatDate(a.due_date)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneClasses(ds.tone)}`}>{ds.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {activeRole === 'manager' && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Team training activity</h2>
          {assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">No training assigned yet.</p>
              <Link to="/training/assign" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Assign training <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.slice(0, 6).map((a) => {
                const ds = dueStatus(a.due_date, a.status);
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <p className="font-medium text-slate-900">{a.employee_name}</p>
                      <p className="text-xs text-slate-500">{a.curriculum_name}{a.class_name ? ` · ${a.class_name}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneClasses(ds.tone)}`}>{ds.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}