import React, { useState } from "react";
import { X } from "lucide-react";
import OwnerImageInput from "./OwnerImageInput";

export default function ProjectCreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: "",
    owner: "",
    owner_image: "",
    start_date: "",
    end_date: "",
    description: ""
  });

  const field = "mt-1 w-full bg-[#161A22] border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-[#2563EB] focus:outline-none";

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onCreate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-[#0D0E12] border border-white/10 rounded-xl shadow-2xl shadow-[#2563EB]/10"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-slate-200">Create Project</h2>
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
              placeholder="e.g. Product Launch"
              className={field}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner</label>
            <input
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="Owner name"
              className={field}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Owner photo</label>
            <div className="mt-1">
              <OwnerImageInput
                name={form.owner}
                value={form.owner_image}
                onChange={(url) => setForm({ ...form, owner_image: url })}
              />
            </div>
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

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className={`${field} resize-none`}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-md transition-colors"
          >
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}