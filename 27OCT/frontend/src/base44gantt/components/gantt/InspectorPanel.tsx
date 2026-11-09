import React, { useMemo } from "react";
import { X, Flag, AlignLeft, Trash2, Link2, GitBranch, Folder, Users } from "lucide-react";
import OwnerImageInput from "./OwnerImageInput";

const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High", milestone: "Milestone" };
const PRIORITY_COLOR = {
  low: "text-sky-300", medium: "text-indigo-300", high: "text-rose-300", milestone: "text-amber-300"
};

export default function InspectorPanel({ item, items, projects, teamMembers = [], onClose, onChange, onDelete, onCascadeOwner }) {
  const descendants = useMemo(() => {
    if (!item || item.kind === "project") return new Set();
    const desc = new Set();
    const add = (id) => {
      const kids = items.filter((it) => it.parent_id === id);
      for (const k of kids) {
        if (!desc.has(k.id)) {
          desc.add(k.id);
          add(k.id);
        }
      }
    };
    add(item.id);
    return desc;
  }, [item, items]);

  if (!item) {
    return (
      <div className="w-80 shrink-0 border-l border-white/5 bg-[#0D0E12] p-6 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#161A22] border border-white/5 flex items-center justify-center mb-4">
          <AlignLeft className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Select a project or task on the timeline to inspect its details.</p>
      </div>
    );
  }

  const patch = (field, value) => onChange({ ...item, [field]: value });

  const inputCls = "mt-1 w-full bg-[#161A22] border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-[#2563EB] focus:outline-none";

  // ---- Project editor ----
  if (item.kind === "project") {
    return (
      <div className="w-80 shrink-0 border-l border-white/5 bg-[#0D0E12] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#2563EB]" /> Project
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Title</label>
            <input value={item.title} onChange={(e) => patch("title", e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner</label>
            <div className="relative mt-1">
              <select
                value={item.owner || ""}
                onChange={(e) => patch("owner", e.target.value)}
                className="w-full appearance-none bg-[#161A22] border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-[#2563EB] focus:outline-none pr-8 cursor-pointer"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <svg className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner photo</label>
            <div className="mt-1">
              <OwnerImageInput name={item.owner} value={item.owner_image || ""} onChange={(url) => patch("owner_image", url)} />
            </div>
          </div>

          <button
            onClick={() => onCascadeOwner?.(item)}
            className="flex items-center justify-center gap-1.5 text-[11px] text-[#93c5fd] hover:text-white border border-[#2563EB]/30 hover:border-[#2563EB]/60 rounded-md py-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Apply owner to all tasks in project
          </button>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">Start</label>
              <input type="date" value={item.start_date} onChange={(e) => patch("start_date", e.target.value)} className={`${inputCls} px-2 py-2 text-xs`} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">End</label>
              <input type="date" value={item.end_date} onChange={(e) => patch("end_date", e.target.value)} className={`${inputCls} px-2 py-2 text-xs`} />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Description</label>
            <textarea value={item.description || ""} onChange={(e) => patch("description", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => onDelete(item)}
            className="w-full flex items-center justify-center gap-2 text-sm text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-md py-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete project
          </button>
        </div>
      </div>
    );
  }

  // ---- Task editor ----
  const hasChildren = items.some((it) => it.parent_id === item.id);

  const parentOptions = items.filter((it) => it.id !== item.id && !descendants.has(it.id));
  const predecessorOptions = items.filter((it) => it.id !== item.id);
  const dependsOn = new Set(item.depends_on || []);

  const toggleDep = (id) => {
    const cur = new Set(item.depends_on || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    patch("depends_on", [...cur]);
  };

  return (
    <div className="w-80 shrink-0 border-l border-white/5 bg-[#0D0E12] flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-slate-200">Task Details</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Title</label>
          <input value={item.title} onChange={(e) => patch("title", e.target.value)} className={inputCls} />
          {hasChildren && (
            <p className="mt-1.5 text-[11px] text-[#93c5fd] flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              Summary task — dates auto-calculated from children.
            </p>
          )}
        </div>

        {hasChildren && (
          <button
            onClick={() => onCascadeOwner?.(item)}
            className="flex items-center justify-center gap-1.5 text-[11px] text-[#93c5fd] hover:text-white border border-[#2563EB]/30 hover:border-[#2563EB]/60 rounded-md py-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Apply owner to all subtasks
          </button>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Project</label>
          <select value={item.project_id || ""} onChange={(e) => patch("project_id", e.target.value)} className={inputCls}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Start</label>
            <input type="date" value={item.start_date} onChange={(e) => patch("start_date", e.target.value)} disabled={hasChildren} className={`${inputCls} px-2 py-2 text-xs ${hasChildren ? "opacity-50 cursor-not-allowed" : ""}`} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">End</label>
            <input type="date" value={item.end_date} onChange={(e) => patch("end_date", e.target.value)} disabled={hasChildren} className={`${inputCls} px-2 py-2 text-xs ${hasChildren ? "opacity-50 cursor-not-allowed" : ""}`} />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner</label>
          <div className="relative mt-1">
            <select
              value={item.owner || ""}
              onChange={(e) => patch("owner", e.target.value)}
              className="w-full appearance-none bg-[#161A22] border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-[#2563EB] focus:outline-none pr-8 cursor-pointer"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <svg className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner photo</label>
          <div className="mt-1">
            <OwnerImageInput name={item.owner} value={item.owner_image || ""} onChange={(url) => patch("owner_image", url)} />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Priority</label>
          <select value={item.priority} onChange={(e) => patch("priority", e.target.value)} className={inputCls}>
            {Object.keys(PRIORITY_LABEL).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Parent task</label>
          <select value={item.parent_id || ""} onChange={(e) => patch("parent_id", e.target.value)} className={inputCls}>
            <option value="">None (top-level in project)</option>
            {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Depends on
          </label>
          <div className="mt-1 max-h-36 overflow-y-auto bg-[#161A22] border border-white/10 rounded-md p-1.5">
            {predecessorOptions.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-600">No other tasks</p>}
            {predecessorOptions.map((o) => (
              <label key={o.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={dependsOn.has(o.id)} onChange={() => toggleDep(o.id)} className="accent-[#2563EB]" />
                <span className="text-xs text-slate-300 truncate">{o.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Progress</span><span className="text-slate-300">{item.progress || 0}%</span>
          </label>
          <input type="range" min={0} max={100} value={item.progress || 0} onChange={(e) => patch("progress", Number(e.target.value))} className="mt-2 w-full accent-[#2563EB]" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500">Description</label>
          <textarea value={item.description || ""} onChange={(e) => patch("description", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </div>

        <div className="pt-2 border-t border-white/5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Flag className={`w-3.5 h-3.5 ${PRIORITY_COLOR[item.priority]}`} />
            {PRIORITY_LABEL[item.priority]}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => onDelete(item)}
          className="w-full flex items-center justify-center gap-2 text-sm text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-md py-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Delete task
        </button>
      </div>
    </div>
  );
}