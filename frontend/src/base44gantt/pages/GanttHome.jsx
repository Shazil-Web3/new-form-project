import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Zap, CalendarDays, FolderPlus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, addDays, startOfDay } from "date-fns";
import { base44 } from "../base44Client";
import TaskTreeSidebar from "../components/gantt/TaskTreeSidebar";
import TimelineHeader from "../components/gantt/TimelineHeader";
import TimelineBody from "../components/gantt/TimelineBody";
import InspectorPanel from "../components/gantt/InspectorPanel";
import TaskCreateModal, { RESOURCES } from "../components/gantt/TaskCreateModal";
import ProjectCreateModal from "../components/gantt/ProjectCreateModal";
import CalendarView from "../components/gantt/CalendarView";
import WorkloadView from "../components/gantt/WorkloadView";
import ShiftLinkedModal from "../components/gantt/ShiftLinkedModal";

const HEADER_HEIGHT = 60;
const ROW_HEIGHT = 56;

const ZOOM_CFG = {
  day:     { dayWidth: 96, days: 7,  label: "Day" },
  week:    { dayWidth: 64, days: 14, label: "Week" },
  month:   { dayWidth: 44, months: 1, label: "Month" },
  quarter: { dayWidth: 22, months: 3, label: "Quarter" }
};

const TASK_FIELDS = (n) => ({
  title: n.title,
  resource: n.resource ?? n.owner,
  owner_image: n.owner_image || "",
  project_id: n.project_id || "",
  start_date: n.start_date,
  end_date: n.end_date,
  priority: n.priority,
  progress: n.progress,
  description: n.description || "",
  depends_on: n.depends_on || [],
  parent_id: n.parent_id || ""
});

const PROJECT_FIELDS = (p) => ({
  title: p.title,
  owner: p.owner || "",
  owner_image: p.owner_image || "",
  start_date: p.start_date,
  end_date: p.end_date,
  description: p.description || ""
});

export default function Home() {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [projects, setProjects] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set()); // keys that are collapsed
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [view, setView] = useState("timeline");
  const [shiftPrompt, setShiftPrompt] = useState(null);
  const [zoom, setZoom] = useState("month");

  const days = useMemo(() => {
    const cfg = ZOOM_CFG[zoom];
    if (cfg.months) {
      const start = startOfMonth(month);
      const end = endOfMonth(addMonths(month, cfg.months - 1));
      return eachDayOfInterval({ start, end });
    }
    const start = startOfDay(month);
    const end = addDays(start, cfg.days - 1);
    return eachDayOfInterval({ start, end });
  }, [month, zoom]);

  // Fit the timeline to the space left next to the site sidebar: columns grow to fill the
  // width, and shrink (down to a floor) so a whole month stays visible without scrolling.
  const centerRef = useRef(null);
  const [centerWidth, setCenterWidth] = useState(0);
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return undefined;
    const update = () => setCenterWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const minDayWidth = zoom === "month" ? 28 : ZOOM_CFG[zoom].dayWidth;
  const dayWidth = centerWidth && days.length
    ? Math.max(minDayWidth, Math.floor(centerWidth / days.length))
    : ZOOM_CFG[zoom].dayWidth;

  const shiftAnchor = useCallback((dir) => {
    const cfg = ZOOM_CFG[zoom];
    if (cfg.months) setMonth(addMonths(month, dir * cfg.months));
    else setMonth(addDays(month, dir * cfg.days));
  }, [month, zoom]);

  const rangeLabel = useMemo(() => {
    if (!days.length) return "";
    const cfg = ZOOM_CFG[zoom];
    if (cfg.months === 1) return format(month, "MMMM yyyy");
    if (cfg.months === 3) return `${format(days[0], "MMM yyyy")} – ${format(days[days.length - 1], "MMM yyyy")}`;
    return `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`;
  }, [days, month, zoom]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projList, itemList] = await Promise.all([
        base44.entities.Project.list(),
        base44.entities.ScheduleItem.list()
      ]);
      setProjects(projList);
      setItems(itemList);
    } catch (e) {
      console.error("Failed to load", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- Build the tree (project -> task -> subtask) ----
  const tree = useMemo(() => {
    const list = [];
    const children = {};
    const byKey = {};

    const projNode = (p) => {
      const key = "p:" + p.id;
      const node = {
        key, id: p.id, kind: "project", depth: 0,
        title: p.title, owner: p.owner, owner_image: p.owner_image,
        start_date: p.start_date, end_date: p.end_date,
        priority: "medium", progress: 0, description: p.description,
        project_id: p.id, parent_id: "", depends_on: []
      };
      return node;
    };
    const taskNode = (it) => {
      const key = "t:" + it.id;
      return {
        key, id: it.id, kind: "task",
        title: it.title, owner: it.resource, owner_image: it.owner_image,
        start_date: it.start_date, end_date: it.end_date,
        priority: it.priority, progress: it.progress, description: it.description,
        project_id: it.project_id || "", parent_id: it.parent_id || "",
        depends_on: it.depends_on || []
      };
    };

    for (const p of projects) {
      const n = projNode(p);
      list.push(n); byKey[n.key] = n;
    }
    // orphan top-level tasks (no project, no parent)
    for (const it of items.filter((i) => !i.project_id && !i.parent_id)) {
      const n = taskNode(it); n.depth = 0;
      list.push(n); byKey[n.key] = n;
    }
    // tasks directly under a project
    for (const it of items.filter((i) => i.project_id && !i.parent_id)) {
      const n = taskNode(it);
      list.push(n); byKey[n.key] = n;
    }
    // subtasks (parent_id set)
    for (const it of items.filter((i) => i.parent_id)) {
      const n = taskNode(it);
      list.push(n); byKey[n.key] = n;
    }

    // children map
    for (const n of list) {
      if (n.kind === "project") {
        children[n.key] = list.filter((c) => c.kind === "task" && c.project_id === n.id && !c.parent_id).map((c) => c.key);
      }
    }
    for (const n of list) {
      if (n.kind === "task") {
        children[n.key] = list.filter((c) => c.kind === "task" && c.parent_id === n.id).map((c) => c.key);
      }
    }

    // compute depth recursively from roots
    const setDepth = (key, d, seen = new Set()) => {
      if (seen.has(key)) return;
      seen.add(key);
      byKey[key].depth = d;
      for (const c of children[key] || []) setDepth(c, d + 1, seen);
    };
    for (const n of list) {
      if (n.kind === "project") setDepth(n.key, 0);
      else if (n.kind === "task" && !n.project_id && !n.parent_id) setDepth(n.key, 0);
    }

    return { list, children, byKey };
  }, [projects, items]);

  // effective (rolled-up) dates per node
  const effOf = useMemo(() => {
    const cache = {};
    const resolve = (key, seen = new Set()) => {
      if (cache[key]) return cache[key];
      if (seen.has(key)) return cache[key];
      seen.add(key);
      const n = tree.byKey[key];
      const kids = tree.children[key] || [];
      if (kids.length === 0) {
        cache[key] = { start_date: n.start_date, end_date: n.end_date };
        return cache[key];
      }
      let min = null, max = null;
      for (const c of kids) {
        const e = resolve(c, seen);
        if (e.start_date && (!min || e.start_date < min)) min = e.start_date;
        if (e.end_date && (!max || e.end_date > max)) max = e.end_date;
      }
      cache[key] = { start_date: min || n.start_date, end_date: max || n.end_date };
      return cache[key];
    };
    return resolve;
  }, [tree]);

  // flatten visible rows respecting collapse state
  const rows = useMemo(() => {
    const out = [];
    const roots = tree.list.filter(
      (n) => n.kind === "project" || (n.kind === "task" && !n.project_id && !n.parent_id)
    );
    const walk = (key) => {
      const n = tree.byKey[key];
      if (!n) return;
      const kids = tree.children[key] || [];
      const hasChildren = kids.length > 0;
      const isExpanded = !collapsed.has(key);
      const e = hasChildren ? effOf(key) : { start_date: n.start_date, end_date: n.end_date };
      out.push({
        key: n.key, id: n.id, kind: n.kind, depth: n.depth,
        title: n.title, owner: n.owner, owner_image: n.owner_image,
        start_date: e.start_date, end_date: e.end_date,
        priority: n.priority, progress: n.progress, depends_on: n.depends_on,
        isSummary: hasChildren, hasChildren, isExpanded, childCount: kids.length
      });
      if (hasChildren && isExpanded) kids.forEach(walk);
    };
    roots.forEach((r) => walk(r.key));
    return out;
  }, [tree, effOf, collapsed]);

  // selected node (editable, own dates)
  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    const n = tree.list.find((x) => x.id === selectedId);
    if (!n) return null;
    const kids = tree.children[n.key] || [];
    return { ...n, hasChildren: kids.length > 0, childCount: kids.length };
  }, [selectedId, tree]);

  const teamMembers = useMemo(() => {
    const set = new Set();
    items.forEach((i) => i.resource && set.add(i.resource));
    projects.forEach((p) => p.owner && set.add(p.owner));
    RESOURCES.forEach((r) => set.add(r));
    return [...set].sort();
  }, [items, projects]);

  const toggleExpand = useCallback((key) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ---- handlers ----
  const handleLiveUpdate = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const handleCommitUpdate = useCallback(async (row) => {
    if (row.kind === "project") {
      const p = projects.find((x) => x.id === row.id);
      if (!p) return;
      try {
        await base44.entities.Project.update(row.id, PROJECT_FIELDS(p));
      } catch (e) { console.error("Project commit failed", e); loadAll(); }
    } else {
      const it = items.find((x) => x.id === row.id);
      if (!it) return;
      try {
        await base44.entities.ScheduleItem.update(row.id, TASK_FIELDS(it));
      } catch (e) { console.error("Commit failed", e); loadAll(); }
    }
  }, [projects, items, loadAll]);

  const handleMoveCommit = useCallback(async (row, deltaDays) => {
    await handleCommitUpdate(row);
    if (!deltaDays) return;
    const seen = new Set();
    const stack = [row.id];
    while (stack.length) {
      const cur = stack.pop();
      for (const it of items) {
        if ((it.depends_on || []).includes(cur) && !seen.has(it.id)) {
          seen.add(it.id);
          stack.push(it.id);
        }
      }
    }
    if (seen.size === 0) return;
    const moved = items.find((i) => i.id === row.id);
    setShiftPrompt({ movedTitle: moved?.title || row.title, deltaDays, dependentIds: [...seen] });
  }, [handleCommitUpdate, items]);

  const handleConfirmShift = useCallback(async () => {
    const p = shiftPrompt;
    if (!p) return;
    const targets = items.filter((i) => p.dependentIds.includes(i.id));
    const shift = (d) => addDays(new Date(d), p.deltaDays).toISOString().slice(0, 10);
    setItems((prev) => prev.map((it) => {
      const t = targets.find((x) => x.id === it.id);
      if (!t) return it;
      return { ...it, start_date: shift(t.start_date), end_date: shift(t.end_date) };
    }));
    try {
      await Promise.all(targets.map((t) =>
        base44.entities.ScheduleItem.update(t.id, TASK_FIELDS({ ...t, start_date: shift(t.start_date), end_date: shift(t.end_date) }))
      ));
    } catch (e) { console.error("Shift failed", e); loadAll(); }
    setShiftPrompt(null);
  }, [shiftPrompt, items, loadAll]);

  const handleInspectorChange = useCallback(async (updated) => {
    if (updated.kind === "project") {
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? {
        ...p, title: updated.title, owner: updated.owner, owner_image: updated.owner_image,
        start_date: updated.start_date, end_date: updated.end_date, description: updated.description
      } : p)));
      try {
        await base44.entities.Project.update(updated.id, PROJECT_FIELDS(updated));
      } catch (e) { console.error("Project update failed", e); loadAll(); }
    } else {
      setItems((prev) => prev.map((it) => (it.id === updated.id ? {
        ...it, title: updated.title, resource: updated.owner, owner_image: updated.owner_image,
        project_id: updated.project_id, start_date: updated.start_date, end_date: updated.end_date,
        priority: updated.priority, progress: updated.progress, description: updated.description,
        depends_on: updated.depends_on, parent_id: updated.parent_id
      } : it)));
      try {
        await base44.entities.ScheduleItem.update(updated.id, TASK_FIELDS(updated));
      } catch (e) { console.error("Update failed", e); loadAll(); }
    }
  }, [loadAll]);

  const handleCreateProject = useCallback(async (form) => {
    const start = form.start_date || days[0].toISOString().slice(0, 10);
    const end = form.end_date || days[days.length - 1].toISOString().slice(0, 10);
    try {
      const created = await base44.entities.Project.create({
        title: form.title, owner: form.owner, owner_image: form.owner_image || "",
        start_date: start, end_date: end, description: form.description || ""
      });
      setProjects((prev) => [...prev, created]);
      setShowCreateProject(false);
      setSelectedId(created.id);
    } catch (e) { console.error("Project create failed", e); }
  }, [days]);

  const handleCreate = useCallback(async (form) => {
    try {
      const created = await base44.entities.ScheduleItem.create({
        title: form.title, resource: form.resource, owner_image: form.owner_image || "",
        project_id: form.project_id || "", start_date: form.start_date, end_date: form.end_date,
        priority: form.priority, progress: 0, description: form.description || "",
        depends_on: [], parent_id: ""
      });
      setItems((prev) => [...prev, created]);
      setShowCreate(false);
      setSelectedId(created.id);
      setMonth(new Date(form.start_date));
    } catch (e) { console.error("Create failed", e); }
  }, []);

  const handleDelete = useCallback(async (node) => {
    try {
      if (node.kind === "project") {
        const tasks = items.filter((i) => i.project_id === node.id);
        await Promise.all(tasks.map((t) =>
          base44.entities.ScheduleItem.update(t.id, TASK_FIELDS({ ...t, project_id: "" }))
        ));
        await base44.entities.Project.delete(node.id);
        setProjects((prev) => prev.filter((p) => p.id !== node.id));
        setItems((prev) => prev.map((i) => (i.project_id === node.id ? { ...i, project_id: "" } : i)));
      } else {
        const kids = items.filter((i) => i.parent_id === node.id);
        await Promise.all(kids.map((k) =>
          base44.entities.ScheduleItem.update(k.id, TASK_FIELDS({ ...k, parent_id: "" }))
        ));
        // remove this task from others' depends_on
        const dependents = items.filter((i) => (i.depends_on || []).includes(node.id));
        await Promise.all(dependents.map((d) =>
          base44.entities.ScheduleItem.update(d.id, TASK_FIELDS({ ...d, depends_on: (d.depends_on || []).filter((x) => x !== node.id) }))
        ));
        await base44.entities.ScheduleItem.delete(node.id);
        setItems((prev) =>
          prev
            .filter((i) => i.id !== node.id)
            .map((i) => (i.parent_id === node.id ? { ...i, parent_id: "" } : i))
            .map((i) => ({ ...i, depends_on: (i.depends_on || []).filter((x) => x !== node.id) }))
        );
      }
      setSelectedId(null);
    } catch (e) { console.error("Delete failed", e); }
  }, [items]);

  const handleLinkCreate = useCallback(async (sourceId, targetId) => {
    const target = items.find((it) => it.id === targetId);
    if (!target) return;
    const cur = new Set(target.depends_on || []);
    if (cur.has(sourceId) || sourceId === targetId) return;
    cur.add(sourceId);
    const updated = { ...target, depends_on: [...cur] };
    setItems((prev) => prev.map((it) => (it.id === targetId ? updated : it)));
    try {
      await base44.entities.ScheduleItem.update(targetId, TASK_FIELDS({ ...updated, owner: updated.resource }));
    } catch (e) { console.error("Link create failed", e); loadAll(); }
  }, [items, loadAll]);

  const handleLinkDelete = useCallback(async (targetId, sourceId) => {
    const target = items.find((it) => it.id === targetId);
    if (!target) return;
    const cur = new Set(target.depends_on || []);
    if (!cur.has(sourceId)) return;
    cur.delete(sourceId);
    const updated = { ...target, depends_on: [...cur] };
    setItems((prev) => prev.map((it) => (it.id === targetId ? updated : it)));
    try {
      await base44.entities.ScheduleItem.update(targetId, TASK_FIELDS({ ...updated, owner: updated.resource }));
    } catch (e) { console.error("Link delete failed", e); loadAll(); }
  }, [items, loadAll]);

  const handleReassignProject = useCallback(async (taskId, newProjectId) => {
    const task = items.find((i) => i.id === taskId);
    if (!task || task.project_id === newProjectId) return;
    // collect all descendants by parent_id so the subtree moves together
    const descIds = new Set();
    const collect = (id) => {
      for (const it of items) {
        if (it.parent_id === id && !descIds.has(it.id)) {
          descIds.add(it.id);
          collect(it.id);
        }
      }
    };
    collect(taskId);
    const toUpdate = [taskId, ...descIds];
    const build = (id) => {
      const cur = items.find((i) => i.id === id);
      return { ...cur, project_id: newProjectId, parent_id: id === taskId ? "" : cur.parent_id };
    };
    const updates = toUpdate.map(build);
    // optimistic
    setItems((prev) => prev.map((it) => {
      const u = updates.find((x) => x.id === it.id);
      return u ? { ...it, project_id: u.project_id, parent_id: u.parent_id } : it;
    }));
    try {
      await Promise.all(updates.map((u) => base44.entities.ScheduleItem.update(u.id, TASK_FIELDS(u))));
    } catch (e) {
      console.error("Reassign failed", e);
      loadAll();
    }
  }, [items, loadAll]);

  const handleCascadeOwner = useCallback(async (node) => {
    const owner = node.owner || "";
    const owner_image = node.owner_image || "";
    let targets = [];
    if (node.kind === "project") {
      targets = items.filter((i) => i.project_id === node.id);
    } else {
      const desc = new Set();
      const collect = (id) => {
        for (const it of items) {
          if (it.parent_id === id && !desc.has(it.id)) {
            desc.add(it.id);
            collect(it.id);
          }
        }
      };
      collect(node.id);
      targets = items.filter((i) => desc.has(i.id));
    }
    if (targets.length === 0) return;
    setItems((prev) => prev.map((it) => (targets.find((t) => t.id === it.id) ? { ...it, resource: owner, owner_image } : it)));
    try {
      await Promise.all(targets.map((t) =>
        base44.entities.ScheduleItem.update(t.id, TASK_FIELDS({ ...t, resource: owner, owner_image }))
      ));
    } catch (e) { console.error("Cascade owner failed", e); loadAll(); }
  }, [items, loadAll]);

  const handleReparent = useCallback(async (taskId, target) => {
    const task = items.find((i) => i.id === taskId);
    if (!task || !target) return;
    if (target.id === taskId) return;
    const desc = new Set();
    const collect = (id) => {
      for (const it of items) {
        if (it.parent_id === id && !desc.has(it.id)) { desc.add(it.id); collect(it.id); }
      }
    };
    collect(taskId);
    if (target.kind === "task" && desc.has(target.id)) return;
    let newParentId, newProjectId;
    if (target.kind === "project") {
      newParentId = "";
      newProjectId = target.id;
    } else {
      newParentId = target.id;
      newProjectId = target.project_id || "";
    }
    if (newParentId === (task.parent_id || "") && newProjectId === (task.project_id || "")) return;
    const updates = [{ id: taskId, parent_id: newParentId, project_id: newProjectId }];
    for (const did of desc) {
      const d = items.find((i) => i.id === did);
      if (d && (d.project_id || "") !== newProjectId) updates.push({ id: did, project_id: newProjectId });
    }
    setItems((prev) => prev.map((it) => {
      const u = updates.find((x) => x.id === it.id);
      return u ? { ...it, ...u } : it;
    }));
    try {
      await Promise.all(updates.map((u) => {
        const cur = items.find((i) => i.id === u.id);
        return base44.entities.ScheduleItem.update(u.id, TASK_FIELDS({ ...cur, ...u }));
      }));
    } catch (e) { console.error("Reparent failed", e); loadAll(); }
  }, [items, loadAll]);

  const handleQuickGenerate = useCallback(async () => {
    const start = days[Math.floor(Math.random() * days.length)];
    const end = addDays(start, Math.floor(Math.random() * 6) + 1);
    const pid = projects.length ? projects[Math.floor(Math.random() * projects.length)].id : "";
    try {
      const created = await base44.entities.ScheduleItem.create({
        title: ["API Integration", "Code Review", "Sprint Planning", "Design Sprint", "Bug Triage", "Release Prep"][Math.floor(Math.random() * 6)],
        resource: RESOURCES[Math.floor(Math.random() * RESOURCES.length)],
        owner_image: "",
        project_id: pid,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        priority: ["low", "medium", "high", "milestone"][Math.floor(Math.random() * 4)],
        progress: Math.floor(Math.random() * 80),
        description: "Auto-generated task.",
        depends_on: [],
        parent_id: ""
      });
      setItems((prev) => [...prev, created]);
    } catch (e) { console.error("Generate failed", e); }
  }, [days, projects]);

  const defaultCreateDate = days[0].toISOString().slice(0, 10);

  return (
    <div className="h-screen flex flex-col bg-[#0D0E12] text-slate-200 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0D0E12]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Obsidian Timeline</h1>
            <p className="text-[11px] text-slate-500">Project & Task Planner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleQuickGenerate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-white/10 hover:border-white/20 rounded-md transition-colors">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Auto-generate
          </button>
          <button onClick={() => setShowCreateProject(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-white/10 hover:border-white/20 rounded-md transition-colors">
            <FolderPlus className="w-3.5 h-3.5 text-[#2563EB]" /> New project
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-md transition-colors">
            <Plus className="w-3.5 h-3.5" /> New task
          </button>
        </div>
      </header>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-[#161A22]/40">
        <div className="flex items-center gap-3">
          <button onClick={() => shiftAnchor(-1)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-semibold text-white min-w-[180px] text-center">{rangeLabel}</span>
          <button onClick={() => shiftAnchor(1)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#161A22] border border-white/10 rounded-md p-0.5">
            {["day", "week", "month", "quarter"].map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2 py-1 text-xs rounded ${zoom === z ? "bg-[#2563EB] text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                {ZOOM_CFG[z].label}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-[#161A22] border border-white/10 rounded-md p-0.5">
            <button
              onClick={() => setView("timeline")}
              className={`px-2.5 py-1 text-xs rounded ${view === "timeline" ? "bg-[#2563EB] text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-2.5 py-1 text-xs rounded ${view === "calendar" ? "bg-[#2563EB] text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("workload")}
              className={`px-2.5 py-1 text-xs rounded ${view === "workload" ? "bg-[#2563EB] text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              Workload
            </button>
          </div>
          <button onClick={() => setMonth(new Date())} className="px-3 py-1 text-xs text-slate-400 hover:text-white border border-white/10 rounded-md">
            Today
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {selectedId && (
          <TaskTreeSidebar
            rows={rows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleExpand={toggleExpand}
            onNewProject={() => setShowCreateProject(true)}
            onNewTask={() => setShowCreate(true)}
            onReassignProject={handleReassignProject}
            headerHeight={HEADER_HEIGHT}
            rowHeight={ROW_HEIGHT}
          />
        )}
        <div ref={centerRef} className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-slate-700 border-t-[#2563EB] rounded-full animate-spin" />
            </div>
          ) : view === "calendar" ? (
            <CalendarView
              month={month}
              items={items}
              projects={projects}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : view === "workload" ? (
            <WorkloadView
              items={items}
              projects={projects}
              selectedId={selectedId}
              onSelect={setSelectedId}
              month={month}
            />
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <div className="sticky top-0 z-50 w-max min-w-full bg-[#0D0E12]">
                  <TimelineHeader days={days} dayWidth={dayWidth} headerHeight={HEADER_HEIGHT} />
                </div>
                <TimelineBody
                  days={days}
                  dayWidth={dayWidth}
                  rows={rows}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onLiveUpdate={handleLiveUpdate}
                  onCommitUpdate={handleCommitUpdate}
                  onToggleExpand={toggleExpand}
                  onLinkCreate={handleLinkCreate}
                  onLinkDelete={handleLinkDelete}
                  onReparent={handleReparent}
                  onMoveCommit={handleMoveCommit}
                />
              </div>
            </>
          )}
        </div>
        <InspectorPanel
          item={selectedNode}
          items={items}
          projects={projects}
          teamMembers={teamMembers}
          onClose={() => setSelectedId(null)}
          onChange={handleInspectorChange}
          onDelete={handleDelete}
          onCascadeOwner={handleCascadeOwner}
        />
      </div>

      {showCreate && (
        <TaskCreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          defaultDate={defaultCreateDate}
          projects={projects}
        />
      )}
      {showCreateProject && (
        <ProjectCreateModal
          onClose={() => setShowCreateProject(false)}
          onCreate={handleCreateProject}
        />
      )}
      {shiftPrompt && (
        <ShiftLinkedModal
          movedTitle={shiftPrompt.movedTitle}
          deltaDays={shiftPrompt.deltaDays}
          dependentTitles={items
            .filter((i) => shiftPrompt.dependentIds.includes(i.id))
            .map((i) => i.title)}
          onConfirm={handleConfirmShift}
          onCancel={() => setShiftPrompt(null)}
        />
      )}
    </div>
  );
}