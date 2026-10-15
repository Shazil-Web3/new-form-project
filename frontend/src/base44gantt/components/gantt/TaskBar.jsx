import React from "react";
import { Flag, ChevronDown, ChevronRight } from "lucide-react";
import OwnerAvatar from "./OwnerAvatar";

const PRIORITY_STYLES = {
  low: { bg: "bg-sky-500/20", border: "border-sky-400/50", text: "text-sky-200", bar: "bg-sky-400" },
  medium: { bg: "bg-indigo-500/20", border: "border-indigo-400/50", text: "text-indigo-200", bar: "bg-indigo-400" },
  high: { bg: "bg-rose-500/20", border: "border-rose-400/50", text: "text-rose-200", bar: "bg-rose-400" },
  milestone: { bg: "bg-amber-500/20", border: "border-amber-400/60", text: "text-amber-200", bar: "bg-amber-400" }
};

const LinkHandle = ({ onLinkStart, item, style }) => (
  <div
    onPointerDown={(e) => { e.stopPropagation(); onLinkStart(e, item); }}
    title="Drag to another task to link"
    className="absolute w-3 h-3 rounded-full bg-[#2563EB] border border-white/70 opacity-0 group-hover:opacity-100 hover:scale-125 cursor-crosshair shadow-[0_0_6px_rgba(37,99,235,0.9)] transition-transform z-50"
    style={style}
  />
);

export default function TaskBar({
  item,
  left,
  width,
  rowHeight,
  isDragging,
  isSelected,
  isSummary,
  isCollapsed,
  onToggleCollapse,
  onPointerDown,
  onResizeStart,
  onLinkStart,
  isLinkSource
}) {
  const isMilestone = item.priority === "milestone" && !isSummary;
  const s = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium;

  if (isSummary) {
    const top = (rowHeight - 30) / 2;
    return (
      <div
        className={`group absolute flex items-center rounded-md bg-[#2563EB]/10 border border-[#2563EB]/40 cursor-pointer select-none ${isSelected ? "ring-2 ring-[#2563EB] ring-offset-1 ring-offset-[#0D0E12]" : ""} ${isDragging ? "opacity-70 z-30" : "z-20"} ${isLinkSource ? "ring-2 ring-amber-400" : ""}`}
        style={{ left: left + 2, top, width: Math.max(width - 4, 90), height: 30 }}
        onPointerDown={(e) => onPointerDown(e, item)}
        title={`${item.title} (summary)`}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-t-md" />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(item.key); }}
          className="ml-1 mr-1 p-0.5 rounded hover:bg-white/10 text-[#2563EB] shrink-0"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <OwnerAvatar name={item.owner} image={item.owner_image} size={18} className="mr-1.5" />
        <span className="text-xs font-semibold text-[#93c5fd] truncate">{item.title}</span>
      </div>
    );
  }

  if (isMilestone) {
    const top = (rowHeight - 28) / 2;
    return (
      <div
        className={`group absolute flex items-center justify-center cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-60 z-30" : "z-20"} ${isLinkSource ? "ring-2 ring-amber-400 rounded-full" : ""}`}
        style={{ left, top, width: 28, height: 28 }}
        onPointerDown={(e) => onPointerDown(e, item)}
      >
        <div className={`relative flex items-center justify-center w-7 h-7 rounded-full ${s.bg} border-2 ${s.border} ${s.text} shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse`}>
          <Flag className="w-3.5 h-3.5" />
        </div>
        <LinkHandle onLinkStart={onLinkStart} item={item} style={{ right: -2, top: "50%", transform: "translateY(-50%)" }} />
      </div>
    );
  }

  const top = (rowHeight - 34) / 2;
  return (
    <div
      className={`group absolute flex items-center gap-1.5 px-2 rounded-md ${s.bg} border ${s.border} ${s.text} cursor-grab active:cursor-grabbing select-none transition-shadow ${isDragging ? "opacity-70 z-30 shadow-lg" : "z-20"} ${isSelected ? "ring-2 ring-[#2563EB] ring-offset-1 ring-offset-[#0D0E12]" : ""} ${isLinkSource ? "ring-2 ring-amber-400" : ""}`}
      style={{ left: left + 2, top, width: Math.max(width - 4, 28), height: 34 }}
      onPointerDown={(e) => onPointerDown(e, item)}
      title={item.title}
    >
      <OwnerAvatar name={item.owner} image={item.owner_image} size={22} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate leading-tight">{item.title}</div>
        <div className="mt-1 h-1 rounded-full bg-black/30 overflow-hidden">
          <div className={`h-full ${s.bar}`} style={{ width: `${item.progress || 0}%` }} />
        </div>
      </div>
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 rounded-l-md"
        onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, item, "start"); }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 rounded-r-md"
        onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, item, "end"); }}
      />
      <LinkHandle onLinkStart={onLinkStart} item={item} style={{ right: -3, top: "50%", transform: "translateY(-50%)" }} />
    </div>
  );
}