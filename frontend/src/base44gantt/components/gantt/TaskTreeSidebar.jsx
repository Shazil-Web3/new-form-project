import React, { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import OwnerAvatar from "./OwnerAvatar";

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 60;

export default function TaskTreeSidebar({
  rows,
  selectedId,
  onSelect,
  onToggleExpand,
  onNewProject,
  onNewTask,
  onReassignProject,
  headerHeight = HEADER_HEIGHT,
  rowHeight = ROW_HEIGHT
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const handleDragStart = (e, row) => {
    if (row.kind !== "task") return; // only tasks are draggable
    e.dataTransfer.setData("text/plain", row.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(row.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragOver = (e, row) => {
    if (row.kind !== "project") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetId !== row.id) setDropTargetId(row.id);
  };

  const handleDragLeave = (row) => {
    if (dropTargetId === row.id) setDropTargetId(null);
  };

  const handleDrop = (e, row) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    setDropTargetId(null);
    setDraggingId(null);
    if (row.kind === "project" && taskId && taskId !== row.id) {
      onReassignProject?.(taskId, row.id);
    }
  };

  return (
    <div className="w-72 shrink-0 border-r border-white/5 bg-[#0D0E12] flex flex-col">
      <div className="flex items-center justify-between px-4 border-b border-white/5" style={{ height: headerHeight }}>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Projects & Tasks</span>
        <button
          onClick={onNewProject}
          title="New project"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {rows.length === 0 && (
          <p className="px-4 py-6 text-xs text-slate-600">No projects yet. Create one to get started.</p>
        )}

        {rows.map((row) => {
          const ind = row.depth * 16 + 8;
          const isSel = selectedId === row.id;
          const isProject = row.kind === "project";
          const isDragging = draggingId === row.id;
          const isDropTarget = dropTargetId === row.id && isProject;
          return (
            <div
              key={row.key}
              draggable={row.kind === "task"}
              onDragStart={(e) => handleDragStart(e, row)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, row)}
              onDragLeave={() => handleDragLeave(row)}
              onDrop={(e) => handleDrop(e, row)}
              onClick={() => onSelect(row.id)}
              className={`w-full flex items-center gap-1.5 px-2 pr-3 border-b border-white/5 transition-colors ${
                isSel ? "bg-[#2563EB]/15" : "hover:bg-white/[0.03]"
              } ${isProject ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${
                isDragging ? "opacity-40" : ""
              } ${isDropTarget ? "bg-[#2563EB]/25 ring-2 ring-inset ring-[#2563EB]" : ""}`}
              style={{ height: rowHeight, paddingLeft: ind }}
              title={isProject ? "Drop a task here to move it to this project" : "Drag onto a project to reassign"}
            >
              {row.hasChildren ? (
                <span
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(row.key); }}
                  className="shrink-0 p-0.5 rounded hover:bg-white/10 text-slate-400"
                  title={row.isExpanded ? "Collapse" : "Expand"}
                >
                  {row.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
              ) : (
                <span className="shrink-0 w-4" />
              )}

              {isProject ? (
                row.isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                )
              ) : null}

              <OwnerAvatar name={row.owner} image={row.owner_image} size={22} />

              <span className="flex-1 min-w-0">
                <span className={`block text-xs truncate ${isProject ? "font-semibold text-slate-100" : "text-slate-300"}`}>
                  {row.title}
                </span>
                <span className="block text-[10px] text-slate-500 truncate">
                  {row.owner || "Unassigned"}
                </span>
              </span>

              {row.hasChildren && (
                <span className="shrink-0 text-[10px] text-slate-600">{row.childCount}</span>
              )}
            </div>
          );
        })}

        <button
          onClick={onNewTask}
          className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-slate-500 hover:text-slate-300 border-b border-white/5"
        >
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>
    </div>
  );
}