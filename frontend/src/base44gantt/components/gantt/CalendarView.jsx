import React, { useMemo } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, format } from "date-fns";
import OwnerAvatar from "./OwnerAvatar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PROJECT_COLORS = [
  { bg: "rgba(37,99,235,0.18)", border: "#2563EB", dot: "#2563EB" },
  { bg: "rgba(217,70,239,0.18)", border: "#d946ef", dot: "#d946ef" },
  { bg: "rgba(20,184,166,0.18)", border: "#14b8a6", dot: "#14b8a6" },
  { bg: "rgba(245,158,11,0.18)", border: "#f59e0b", dot: "#f59e0b" },
  { bg: "rgba(244,63,94,0.18)", border: "#f43f5e", dot: "#f43f5e" },
  { bg: "rgba(139,92,246,0.18)", border: "#8b5cf6", dot: "#8b5cf6" }
];
const ORPHAN_COLOR = { bg: "rgba(148,163,184,0.15)", border: "#64748b", dot: "#94a3b8" };

const colorFor = (id, projects) => {
  if (!id) return ORPHAN_COLOR;
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return ORPHAN_COLOR;
  return PROJECT_COLORS[idx % PROJECT_COLORS.length];
};

const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export default function CalendarView({ month, items, projects, selectedId, onSelect }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const today = new Date();

  return (
    <div className="flex-1 flex flex-col bg-[#0D0E12] overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-white/10 bg-[#161A22]/60">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-r border-white/5 last:border-r-0">
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-auto">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth();
          const dayTasks = items
            .filter((it) => {
              const s = new Date(it.start_date);
              const e = new Date(it.end_date);
              return d >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) &&
                     d <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
            })
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

          return (
            <div
              key={i}
              className={`min-h-[92px] border-r border-b border-white/5 p-1.5 flex flex-col gap-1 ${inMonth ? "bg-[#0D0E12]" : "bg-black/30"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${isToday(d) ? "bg-[#2563EB] text-white w-5 h-5 rounded-full flex items-center justify-center" : inMonth ? "text-slate-400" : "text-slate-700"}`}>
                  {format(d, "d")}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[9px] text-slate-600">{dayTasks.length}</span>
                )}
              </div>

              <div className="flex flex-col gap-1 overflow-hidden">
                {dayTasks.slice(0, 4).map((it) => {
                  const isStart = isSameDay(new Date(it.start_date), d);
                  const isMilestone = it.priority === "milestone";
                  const c = colorFor(it.project_id, projects);
                  const sel = selectedId === it.id;
                  return (
                    <button
                      key={it.id}
                      onClick={() => onSelect(it.id)}
                      className={`group flex items-center gap-1.5 rounded px-1.5 py-[3px] text-left transition-colors ${
                        sel ? "ring-1 ring-[#2563EB]" : ""
                      } ${isStart ? "text-slate-100" : ""}`}
                      style={{ background: isStart ? c.bg : "transparent", borderLeft: isStart ? `2px solid ${c.border}` : `2px solid ${c.border}55` }}
                      title={it.title}
                    >
                      {isMilestone && <span className="text-amber-400 text-[10px]">◆</span>}
                      {isStart && (
                        <OwnerAvatar name={it.resource} image={it.owner_image} size={16} />
                      )}
                      {isStart && (
                        <span className="text-[11px] truncate">{it.title}</span>
                      )}
                      {!isStart && (
                        <span className="text-[10px] text-slate-500 truncate">{it.title}</span>
                      )}
                    </button>
                  );
                })}
                {dayTasks.length > 4 && (
                  <span className="text-[10px] text-slate-500 pl-1.5">+{dayTasks.length - 4} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}