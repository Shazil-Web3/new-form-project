import React, { useState } from "react";
import { X } from "lucide-react";
import OwnerImageInput from "./OwnerImageInput";

const RESOURCES = ["Alex Chen", "Maya Patel", "Jordan Kim", "Sam Rivera", "Dev Okafor"];
const PRIORITIES = ["low", "medium", "high", "milestone"];

export default function TaskCreateModal({ onClose, onCreate, defaultDate, projects = [] }) {
  const [form, setForm] = useState({
    title: "",
    resource: RESOURCES[0],
    owner_image: "",
    project_id: projects[0]?.id || "",
    start_date: defaultDate,
    end_date: defaultDate,
    priority: "medium",
    description: "",
    progress: 0
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onCreate(form);
  };

  const field = "mt-1 w-full bg-[#161A22] border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-[#2563EB] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-[#0D0E12] border border-white/10 rounded-xl shadow-2xl shadow-[#2563EB]/10"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-slate-200">Create Task</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Design review"
              className={field}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Project</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className={field}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">Start</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={field} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">End</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner</label>
              <select value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} className={field}>
                {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={`${field} capitalize`}>
                {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner photo</label>
            <div className="mt-1">
              <OwnerImageInput
                name={form.resource}
                value={form.owner_image}
                onChange={(url) => setForm({ ...form, owner_image: url })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-md transition-colors">Create task</button>
        </div>
      </form>
    </div>
  );
}

export { RESOURCES };