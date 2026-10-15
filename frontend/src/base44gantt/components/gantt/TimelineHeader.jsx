import React from "react";
import { format, isToday, isWeekend } from "date-fns";

export default function TimelineHeader({ days, dayWidth, headerHeight, todayOffset }) {
  return (
    <div className="flex border-b border-white/5 bg-[#0D0E12]">
      {days.map((day) => {
        const weekend = isWeekend(day);
        const today = isToday(day);
        return (
          <div
            key={day.toISOString()}
            className={`flex flex-col items-center justify-center shrink-0 border-r border-white/5 ${weekend ? "bg-white/[0.015]" : ""}`}
            style={{ width: dayWidth, height: headerHeight }}
          >
            {dayWidth >= 40 && (
              <div className={`text-[10px] uppercase tracking-wide ${weekend ? "text-slate-600" : "text-slate-500"}`}>
                {format(day, "EEE")}
              </div>
            )}
            <div
              className={`font-semibold ${dayWidth < 30 ? "text-xs" : "text-sm"} ${
                today ? "text-white" : weekend ? "text-slate-600" : "text-slate-300"
              }`}
            >
              {today ? (
                <span className={`rounded-md bg-[#2563EB] text-white ${dayWidth < 30 ? "px-1" : "px-2 py-0.5"}`}>{format(day, "d")}</span>
              ) : (
                format(day, "d")
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}