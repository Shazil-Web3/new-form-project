import React from 'react';
import { Link } from 'react-router-dom';
import { CONTENT_TYPES, TONES, ui } from '../theme';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className={ui.title}>{title}</h1>
        {subtitle ? <p className={ui.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon, tone = 'violet', value, label }) {
  return (
    <div className={`${ui.card} p-5`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-0.5 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', message, actionLabel, actionTo, tone = 'text-slate-400' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <span className={`material-symbols-outlined text-[36px] ${tone}`}>{icon}</span>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      {actionLabel && actionTo ? (
        <Link to={actionTo} className={`${ui.link} mt-3`}>
          {actionLabel}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      ) : null}
    </div>
  );
}

export function ProgressBar({ percent, tone = 'bg-violet-600' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export function TypeBadge({ type }) {
  const required = type === 'required';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        required ? 'bg-violet-100 text-violet-700' : 'bg-fuchsia-50 text-fuchsia-700'
      }`}
    >
      {required ? 'Required' : 'Elective'}
    </span>
  );
}

export function StatusChip({ status }) {
  const styles = {
    completed: 'bg-emerald-50 text-emerald-700',
    overdue: 'bg-red-50 text-red-700',
    in_progress: 'bg-amber-50 text-amber-700',
    assigned: 'bg-slate-100 text-slate-600',
  };
  const labels = { completed: 'Completed', overdue: 'Overdue', in_progress: 'In progress', assigned: 'Not started' };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

export function DaysChip({ days, label }) {
  const tone = days < 0 ? 'bg-red-50 text-red-700' : days <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}

export function Avatar({ name, size = 'h-10 w-10', tone = 'bg-violet-50 text-violet-700' }) {
  return (
    <span className={`flex ${size} flex-none items-center justify-center rounded-full text-sm font-semibold uppercase ${tone}`}>
      {(name || '?').trim().charAt(0)}
    </span>
  );
}

export function ContentIcon({ type, size = 'h-11 w-11' }) {
  const config = CONTENT_TYPES[type] || CONTENT_TYPES.pdf;
  return (
    <span className={`flex ${size} flex-none items-center justify-center rounded-xl ${TONES[config.tone]}`}>
      <span className="material-symbols-outlined text-[22px]">{config.icon}</span>
    </span>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <span className="material-symbols-outlined text-[16px]">chevron_right</span> : null}
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function BackLink({ to, label = 'Back' }) {
  return (
    <Link to={to} className="mb-6 flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      {label}
    </Link>
  );
}
