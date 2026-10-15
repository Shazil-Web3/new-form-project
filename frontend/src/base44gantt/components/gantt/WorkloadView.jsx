import React, { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import OwnerAvatar from "./OwnerAvatar";

const PRIORITY_DOT = {
  low: "#38bdf8", medium: "#818cf8", high: "#fb7185", milestone: "#fbbf24"
};

export default function WorkloadView({ items, projects, selectedId, onSelect, month }) {
  const owners = useMemo(() => {
    const map = new Map();
    const ensure = (name, image) => {
      const key = (name || "").trim() || "Unassigned";
      if (!map.has(key)) map.set(key, { name: key, image: image || "", tasks: [] });
      else if (!map.get(key).image && image) map.get(key).image = image;
      return map.get(key);
    };
    for (const it of items) {
      const o = ensure(it.resource, it.owner_image);
      o.tasks.push(it);
    }
    return [...map.values()];
  }, [items]);

  const monthStart = month ? new Date(month.getFullYear(), month.getMonth(), 1) : null;
  const monthEnd = month ? new Date(month.getFullYear(), month.getMonth() + 1, 0) : null;

  const inMonthDays = (it) => {
    if (!monthStart) return differenceInCalendarDays(new Date(it.end_date), new Date(it.start_date)) + 1;
    const s = new Date(Math.max(new Date(it.start_date), monthStart));
    const e = new Date(Math.min(new Date(it.end_date), monthEnd));
    return Math.max(0, differenceInCalendarDays(e, s) + 1);
  };

  if (owners.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No tasks to analyze.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#0D0E12] p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 px-1">
          Workload by owner {month ? `· ${month.toLocaleString('default', { month: 'long', year: 'numeric' })}` : ""}
        </p>
        {owners.map((o) => {
          const totalDays = o.tasks.reduce((sum, t) => sum + inMonthDays(t), 0);
          const open = o.tasks.filter((t) => (t.progress || 0) < 100).length;
          const maxDays = Math.max(1, ...owners.map((x) => x.tasks.reduce((s, t) => s + inMonthDays(t), 0)));
          const loadPct = Math.round((totalDays / maxDays) * 100);
          return (
            <div key={o.name} className="rounded-lg border border-white/5 bg-[#161A22] p-4">
              <div className="flex items-center gap-3 mb-3">
                <OwnerAvatar name={o.name} image={o.image} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">{o.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {o.tasks.length} task{o.tasks.length !== 1 ? "s" : ""} · {open} open · {totalDays} day{totalDays !== 1 ? "s" : ""} booked
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#2563EB]">{loadPct}%</div>
                  <div className="text-[10px] text-slate-600">load</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-black/40 overflow-hidden mb-3">
                <div className="h-full bg-[#2563EB]" style={{ width: `${loadPct}%` }} />
              </div>
              <div className="space-y-1.5">
                {o.tasks
                  .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                  .map((t) => {
                    const proj = projects.find((p) => p.id === t.project_id);
                    const sel = selectedId === t.id;
                    const days = differenceInCalendarDays(new Date(t.end_date), new Date(t.start_date)) + 1;
                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${sel ? "bg-[#2563EB]/15 ring-1 ring-[#2563EB]" : "hover:bg-white/[0.03]"}`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_DOT[t.priority] || PRIORITY_DOT.medium }} />
                        <span className="flex-1 min-w-0 text-xs text-slate-200 truncate">{t.title}</span>
                        {proj && <span className="text-[10px] text-slate-500 truncate hidden sm:block">{proj.title}</span>}
                        <span className="text-[10px] text-slate-500 shrink-0">{days}d</span>
                        <span className="text-[10px] text-slate-500 shrink-0 w-8 text-right">{t.progress || 0}%</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}