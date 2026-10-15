import React from "react";
import { UserPlus } from "lucide-react";

export default function TeamAssignDropdown({ members, selectedTask, onAssign }) {
  return (
    <div className="relative flex items-center">
      <UserPlus className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
      <select
        value=""
        disabled={!selectedTask}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onAssign?.(v);
          e.target.value = "";
        }}
        className={`appearance-none bg-[#161A22] border border-white/10 rounded-md pl-7 pr-6 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#2563EB] ${
          selectedTask ? "hover:border-white/20 cursor-pointer" : "opacity-50 cursor-not-allowed"
        }`}
        title={selectedTask ? `Assign owner to "${selectedTask.title}"` : "Select a task first"}
      >
        <option value="">{selectedTask ? "Assign to…" : "Assign owner"}</option>
        {members.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <svg className="w-3 h-3 text-slate-500 absolute right-1.5 pointer-events-none" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}