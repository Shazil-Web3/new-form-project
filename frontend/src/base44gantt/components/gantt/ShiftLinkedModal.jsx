import React from "react";
import { X, Link2, ArrowRight } from "lucide-react";

export default function ShiftLinkedModal({ movedTitle, deltaDays, dependentTitles, onConfirm, onCancel }) {
  const sign = deltaDays > 0 ? "+" : "";
  const dayLabel = `${sign}${deltaDays} day${Math.abs(deltaDays) === 1 ? "" : "s"}`;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[420px] bg-[#161A22] border border-white/10 rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#2563EB]" /> Shift linked tasks?
          </h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-300">
            <span className="font-medium text-white">{movedTitle}</span> moved <span className="text-[#93c5fd] font-medium">{dayLabel}</span>.
          </p>
          <p className="text-xs text-slate-500">
            {dependentTitles.length} linked task{dependentTitles.length === 1 ? "" : "s"} depend on it. Shift them by the same amount to keep the schedule aligned?
          </p>
          <div className="max-h-32 overflow-y-auto bg-[#0D0E12] border border-white/5 rounded-md p-2 space-y-1">
            {dependentTitles.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <ArrowRight className="w-3 h-3 text-[#2563EB] shrink-0" />
                <span className="truncate">{t}</span>
                <span className="text-slate-500 ml-auto">{dayLabel}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-300 border border-white/10 hover:border-white/20 rounded-md transition-colors">Keep as-is</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-md transition-colors">Shift linked tasks</button>
        </div>
      </div>
    </div>
  );
}