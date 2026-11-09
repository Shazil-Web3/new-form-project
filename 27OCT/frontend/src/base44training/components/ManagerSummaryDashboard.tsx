import React from 'react';
import { TrendingUp, AlertTriangle, Clock, Users, ChevronRight } from 'lucide-react';
import { statusToneClasses, formatDate } from '../lib/training';

function StatCard({ icon: Icon, label, value, sublabel, tone }) {
  const toneClasses = {
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone] || toneClasses.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-tight text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
      {sublabel && <p className="mt-2 text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}

export default function ManagerSummaryDashboard({ stats, fallingBehind }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} tone="indigo" label="Team completion" value={`${stats.overallPct}%`} sublabel={`${stats.completedClasses} of ${stats.totalClasses} classes done`} />
        <StatCard icon={Users} tone="green" label="On track" value={stats.onTrack} sublabel={`${stats.totalEmployees} team member${stats.totalEmployees !== 1 ? 's' : ''}`} />
        <StatCard icon={AlertTriangle} tone="amber" label="At risk" value={stats.atRisk} sublabel="Due within 3 days" />
        <StatCard icon={Clock} tone="red" label="Overdue required" value={stats.overdueRequired} sublabel="Past due & incomplete" />
      </div>

      {fallingBehind.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/40 shadow-sm">
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-semibold text-rose-900">Falling Behind on Required Training</h3>
            <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{fallingBehind.length} employee{fallingBehind.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-rose-100">
            {fallingBehind.map((emp) => (
              <div key={emp.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700">
                      {(emp.name || emp.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{emp.name || 'Unnamed'}</p>
                      <p className="text-xs text-slate-500">{emp.overdueCount} overdue · {emp.atRiskCount} due soon</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{emp.completionPct}% done</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {emp.items.map((item, i) => (
                    <span key={i} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneClasses(item.tone)}`}>
                      {item.name} · {item.label} · Due {formatDate(item.due_date)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}