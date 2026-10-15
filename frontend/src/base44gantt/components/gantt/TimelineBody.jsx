import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { differenceInCalendarDays, addDays } from "date-fns";
import TaskBar from "./TaskBar";

const ROW_HEIGHT = 56;

export default function TimelineBody({
  days,
  dayWidth = 44,
  rows,
  selectedId,
  onSelect,
  onLiveUpdate,
  onCommitUpdate,
  onToggleExpand,
  onLinkCreate,
  onLinkDelete,
  onReparent,
  onMoveCommit
}) {
  const DAY_WIDTH = dayWidth;
  const scrollRef = useRef(null);
  const innerRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [link, setLink] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const dragRef = useRef(null);
  const linkRef = useRef(null);

  const dayIndex = (date) => differenceInCalendarDays(date, days[0]);

  const startDrag = useCallback((e, row, mode = "move") => {
    e.preventDefault();
    if (row.isSummary) {
      onSelect(row.id);
      return;
    }
    const d = {
      row,
      mode,
      axis: null,
      startX: e.clientX,
      startY: e.clientY,
      origStart: new Date(row.start_date),
      origEnd: new Date(row.end_date)
    };
    dragRef.current = d;
    setDrag(d);
    onSelect(row.id);
  }, [onSelect]);

  const startLink = useCallback((e, row) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = innerRef.current?.getBoundingClientRect();
    const l = {
      sourceId: row.id,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0)
    };
    linkRef.current = l;
    setLink(l);
  }, []);

  // window-level pointer handling so the drag survives DOM re-renders
  useEffect(() => {
    const onMove = (e) => {
      if (linkRef.current) {
        const rect = innerRef.current?.getBoundingClientRect();
        setLink((l) => (l ? { ...l, x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0) } : l));
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.mode === "move" && !d.axis && Math.hypot(dx, dy) > 6) {
        d.axis = Math.abs(dy) > Math.abs(dx) ? "reparent" : "horizontal";
      }
      if (d.mode === "move" && d.axis === "reparent") {
        const rect = innerRef.current?.getBoundingClientRect();
        const y = e.clientY - (rect?.top || 0);
        let idx = Math.floor(y / ROW_HEIGHT);
        idx = Math.max(0, Math.min(rows.length - 1, idx));
        const target = rows[idx];
        setDropTargetId(target && target.id !== d.row.id ? target.id : null);
        return;
      }
      if (d.mode === "move" && !d.axis) return;
      const deltaDays = Math.round(dx / DAY_WIDTH);
      if (d.mode === "move") {
        const newStart = addDays(d.origStart, deltaDays);
        const newEnd = addDays(d.origEnd, deltaDays);
        onLiveUpdate(d.row.id, {
          start_date: newStart.toISOString().slice(0, 10),
          end_date: newEnd.toISOString().slice(0, 10)
        });
      } else if (d.mode === "start") {
        const newStart = addDays(d.origStart, deltaDays);
        if (differenceInCalendarDays(d.origEnd, newStart) >= 0) {
          onLiveUpdate(d.row.id, { start_date: newStart.toISOString().slice(0, 10) });
        }
      } else if (d.mode === "end") {
        const newEnd = addDays(d.origEnd, deltaDays);
        if (differenceInCalendarDays(newEnd, d.origStart) >= 0) {
          onLiveUpdate(d.row.id, { end_date: newEnd.toISOString().slice(0, 10) });
        }
      }
    };
    const onUp = (e) => {
      if (linkRef.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const wrapper = el?.closest?.("[data-task-id]");
        const targetId = wrapper?.getAttribute?.("data-task-id");
        if (targetId && targetId !== linkRef.current.sourceId) {
          onLinkCreate?.(linkRef.current.sourceId, targetId);
        }
        linkRef.current = null;
        setLink(null);
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "move" && d.axis === "reparent") {
        const rect = innerRef.current?.getBoundingClientRect();
        const y = e.clientY - (rect?.top || 0);
        let idx = Math.floor(y / ROW_HEIGHT);
        idx = Math.max(0, Math.min(rows.length - 1, idx));
        const target = rows[idx];
        if (target && target.id !== d.row.id) onReparent?.(d.row.id, target);
        setDropTargetId(null);
        dragRef.current = null;
        setDrag(null);
        return;
      }
      if (d.mode === "move" && d.axis === "horizontal") {
        const deltaDays = Math.round((e.clientX - d.startX) / DAY_WIDTH);
        setDropTargetId(null);
        onMoveCommit?.(d.row, deltaDays);
        dragRef.current = null;
        setDrag(null);
        return;
      }
      setDropTargetId(null);
      onCommitUpdate?.(d.row);
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [rows, dayWidth, onLiveUpdate, onCommitUpdate, onLinkCreate, onReparent, onMoveCommit]);

  const { layout, positions } = useMemo(() => {
    const res = [];
    const pos = {};
    rows.forEach((row, i) => {
      const isMilestone = row.priority === "milestone" && !row.isSummary;
      const startIdx = dayIndex(new Date(row.start_date));
      let endIdx = dayIndex(new Date(row.end_date));
      if (isMilestone) endIdx = startIdx;
      const top = i * ROW_HEIGHT;
      if (endIdx < 0 || startIdx > days.length - 1) {
        pos[row.id] = { top, logicalLeft: 0, logicalRight: 0, centerY: top + ROW_HEIGHT / 2, hidden: true };
        return;
      }
      const clampedStart = Math.max(0, startIdx);
      const duration = isMilestone ? 1 : differenceInCalendarDays(new Date(row.end_date), new Date(row.start_date)) + 1;
      const left = clampedStart * DAY_WIDTH;
      const width = duration * DAY_WIDTH;
      const entry = {
        row,
        left,
        width,
        top,
        isMilestone,
        logicalLeft: isMilestone ? left + DAY_WIDTH / 2 : left,
        logicalRight: isMilestone ? left + DAY_WIDTH / 2 : left + width,
        centerY: top + ROW_HEIGHT / 2,
        hidden: false
      };
      res.push(entry);
      pos[row.id] = entry;
    });
    return { layout: res, positions: pos };
  }, [rows, days, dayWidth]);

  const arrows = useMemo(() => {
    const arr = [];
    for (const entry of layout) {
      const deps = entry.row.depends_on || [];
      for (const predId of deps) {
        const pred = positions[predId];
        if (pred && !pred.hidden) arr.push({ from: pred, to: entry });
      }
    }
    return arr;
  }, [layout, positions]);

  const arrowPath = (from, to) => {
    const fromX = from.logicalRight;
    const fromY = from.centerY;
    const toX = to.logicalLeft;
    const toY = to.centerY;
    const gap = 10;
    const midX = Math.max(fromX + gap, toX - gap);
    return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX - 4} ${toY}`;
  };

  const sourcePos = link ? positions[link.sourceId] : null;
  const tempPath = sourcePos && !sourcePos.hidden
    ? `M ${sourcePos.logicalRight} ${sourcePos.centerY} L ${link.x} ${link.y}`
    : "";

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden bg-[#0D0E12]">
      <div ref={innerRef} className="relative" style={{ width: days.length * DAY_WIDTH, height: rows.length * ROW_HEIGHT }}>
        <div className="flex">
          {days.map((d, i) => {
            const wd = d.getDay();
            return (
              <div
                key={i}
                className={`shrink-0 border-r border-white/5 ${wd === 0 || wd === 6 ? "bg-white/[0.015]" : ""}`}
                style={{ width: DAY_WIDTH, height: rows.length * ROW_HEIGHT }}
              />
            );
          })}
        </div>

        <div className="absolute inset-0 pointer-events-none">
          {rows.map((r) => (
            <div
              key={r.key}
              className="absolute left-0 right-0 border-b border-white/5 bg-[#161A22]/30"
              style={{ top: positions[r.id]?.top ?? 0, height: ROW_HEIGHT }}
            />
          ))}
          {dropTargetId && positions[dropTargetId] && (
            <div
              className="absolute left-0 right-0 border-2 border-dashed border-[#2563EB] bg-[#2563EB]/15 rounded-sm"
              style={{ top: positions[dropTargetId].top, height: ROW_HEIGHT }}
            />
          )}
        </div>

        {layout.map((entry) => {
          const isReparentDrag = drag?.row.id === entry.row.id && drag?.axis === "reparent";
          const dropTop = dropTargetId && positions[dropTargetId] ? positions[dropTargetId].top : null;
          const dy = isReparentDrag && dropTop != null ? dropTop - entry.top : 0;
          return (
            <div
              key={entry.row.key}
              data-task-id={entry.row.id}
              style={{
                position: "absolute",
                left: entry.left,
                top: entry.top,
                width: Math.max(entry.width, 28),
                height: ROW_HEIGHT,
                transform: dy ? `translateY(${dy}px)` : undefined,
                transition: isReparentDrag ? "transform 0.12s ease-out" : undefined,
                zIndex: isReparentDrag ? 50 : undefined,
                opacity: isReparentDrag ? 0.95 : undefined
              }}
            >
              <TaskBar
                item={entry.row}
                left={0}
                width={entry.width}
                rowHeight={ROW_HEIGHT}
                isDragging={drag?.row.id === entry.row.id}
                isSelected={selectedId === entry.row.id}
                isSummary={entry.row.isSummary}
                isCollapsed={!entry.row.isExpanded}
                isLinkSource={link?.sourceId === entry.row.id}
                onToggleCollapse={onToggleExpand}
                onPointerDown={(e, row) => startDrag(e, row, "move")}
                onResizeStart={(e, row, side) => startDrag(e, row, side)}
                onLinkStart={startLink}
              />
            </div>
          );
        })}

        <svg
          className="absolute top-0 left-0 z-40"
          width={days.length * DAY_WIDTH}
          height={rows.length * ROW_HEIGHT}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <defs>
            <marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#2563EB" />
            </marker>
            <marker id="dep-arrow-temp" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#fbbf24" />
            </marker>
            <filter id="dep-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {arrows.map((a, i) => {
            const d = arrowPath(a.from, a.to);
            const pe = link ? "none" : "auto";
            return (
              <g key={i} style={{ pointerEvents: pe }}>
                <path
                  d={d}
                  stroke="transparent"
                  strokeWidth={14}
                  fill="none"
                  pointerEvents={link ? "none" : "stroke"}
                  onClick={() => onLinkDelete?.(a.to.row.id, a.from.row.id)}
                  style={{ cursor: "pointer" }}
                />
                <path
                  d={d}
                  stroke="#2563EB"
                  strokeWidth={1.5}
                  fill="none"
                  markerEnd="url(#dep-arrow)"
                  filter="url(#dep-glow)"
                  opacity={0.9}
                  pointerEvents="none"
                />
              </g>
            );
          })}
          {tempPath && (
            <path d={tempPath} stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 3" fill="none" markerEnd="url(#dep-arrow-temp)" opacity={0.95} />
          )}
        </svg>
      </div>
    </div>
  );
}