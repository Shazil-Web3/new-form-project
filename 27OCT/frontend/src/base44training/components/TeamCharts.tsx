import React from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const STATUS_COLORS = {
  Completed: '#10b981',
  'In Progress': '#6366f1',
  Assigned: '#94a3b8',
  Overdue: '#f43f5e',
};

export function TeamStatusDonut({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const completed = data.find((d) => d.name === 'Completed')?.value || 0;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Team Training Status</h3>
        <p className="text-xs text-slate-500">Distribution across all team assignments</p>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-48 w-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-slate-900">{completionPct}%</span>
            <span className="text-xs text-slate-400">completed</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] }} />
                <span className="text-slate-600">{d.name}</span>
              </div>
              <span className="font-medium text-slate-900">{d.value}</span>
            </div>
          ))}
          <div className="mt-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
            {total} total assignment{total !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeCompletionChart({ data }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Completion by Employee</h3>
        <div className="py-8 text-center text-sm text-slate-400">No team members yet.</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Completion by Employee</h3>
        <p className="text-xs text-slate-500">Percentage of assigned training completed</p>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value) => [`${value}%`, 'Completed']}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.pct === 100 ? '#10b981' : entry.pct >= 50 ? '#6366f1' : '#f59e0b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}