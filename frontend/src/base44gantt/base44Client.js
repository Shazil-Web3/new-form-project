// Adapter: exposes the small slice of the Base44 SDK that the copied Gantt code uses
// (base44.entities.Project / ScheduleItem and base44.integrations.Core.UploadPublicFile)
// and maps it onto this app's own backend (tasks, task_dependencies, gantt_projects, users).
import apiClient from '../api/apiClient';
import { RESOURCES } from './components/gantt/TaskCreateModal';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fullName = (first, last) => `${first || ''} ${last || ''}`.trim();
const today = () => new Date().toISOString().slice(0, 10);

// ---- team members (users of the organisation) ----
let usersPromise = null;
let usersByName = new Map();

const loadUsers = () => {
  if (!usersPromise) {
    usersPromise = apiClient
      .get('/api/users')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        usersByName = new Map(list.map((u) => [fullName(u.first_name, u.last_name), u.id]));
        const names = [...usersByName.keys()].filter(Boolean).sort();
        // The copied UI reads its dropdown options from RESOURCES; fill it with the real team.
        if (names.length > 0) RESOURCES.splice(0, RESOURCES.length, ...names);
      })
      .catch((e) => {
        console.error('Failed to load team members', e);
      });
  }
  return usersPromise;
};

const userIdForName = async (name) => {
  if (!name) return null;
  await loadUsers();
  const id = usersByName.get(name);
  return id === undefined ? undefined : id; // undefined = unknown name, leave assignee untouched
};

// ---- mapping: backend rows -> Base44 entity shape ----
const toItem = (t) => {
  const start = t.start_date || t.due_date || t.created_date || today();
  const end = t.due_date || t.start_date || t.created_date || today();
  return {
    id: str(t.id),
    title: t.title,
    resource: fullName(t.assigned_to_first_name, t.assigned_to_last_name),
    owner_image: '',
    project_id: str(t.gantt_project_id),
    parent_id: str(t.parent_task_id),
    start_date: start,
    end_date: end < start ? start : end,
    priority: t.priority || 'medium',
    progress: Number(t.progress) || 0,
    description: t.description || '',
    depends_on: (t.depends_on || []).map(str),
  };
};

const toProject = (p) => ({
  id: str(p.id),
  title: p.title,
  owner: fullName(p.owner_first_name, p.owner_last_name),
  owner_image: '',
  start_date: p.start_date || today(),
  end_date: p.end_date || p.start_date || today(),
  description: p.description || '',
});

const taskPayload = async (f) => {
  const payload = {};
  if (f.title !== undefined) payload.title = f.title;
  if (f.description !== undefined) payload.description = f.description || '';
  if (f.start_date !== undefined) payload.start_date = f.start_date;
  if (f.end_date !== undefined) payload.due_date = f.end_date;
  if (f.priority !== undefined) payload.priority = f.priority;
  if (f.progress !== undefined) payload.progress = Math.max(0, Math.min(100, Math.round(Number(f.progress) || 0)));
  if (f.depends_on !== undefined) payload.depends_on = (f.depends_on || []).map(Number);
  if (f.project_id !== undefined) payload.gantt_project_id = num(f.project_id);
  if (f.parent_id !== undefined) payload.parent_task_id = num(f.parent_id);
  if (f.resource !== undefined) {
    const id = await userIdForName(f.resource);
    if (id !== undefined) payload.assigned_to = id; // null clears, unknown name is ignored
  }
  return payload;
};

const ScheduleItem = {
  async list() {
    await loadUsers();
    const { data } = await apiClient.get('/api/tasks/gantt');
    return (Array.isArray(data) ? data : []).map(toItem);
  },

  async update(id, fields) {
    const payload = await taskPayload(fields);
    const { data } = await apiClient.patch(`/api/tasks/${id}`, payload);
    return data;
  },

  async create(fields) {
    const payload = await taskPayload(fields);
    const { priority, gantt_project_id, parent_task_id, depends_on, ...base } = payload;
    // POST /api/tasks only knows low/medium/high; the rest goes through PATCH.
    const createBody = { ...base, priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium' };
    const { data } = await apiClient.post('/api/tasks', createBody);
    const id = data.id ?? data.taskId;
    const extra = {};
    if (priority && priority !== createBody.priority) extra.priority = priority;
    if (gantt_project_id) extra.gantt_project_id = gantt_project_id;
    if (parent_task_id) extra.parent_task_id = parent_task_id;
    if (depends_on && depends_on.length) extra.depends_on = depends_on;
    if (fields.progress) extra.progress = payload.progress;
    if (Object.keys(extra).length) await apiClient.patch(`/api/tasks/${id}`, extra);
    return { ...fields, id: str(id) };
  },

  async delete(id) {
    await apiClient.delete(`/api/tasks/${id}`);
  },
};

const projectPayload = async (f) => {
  const ownerId = await userIdForName(f.owner);
  return {
    title: f.title,
    description: f.description || '',
    owner_id: ownerId === undefined ? null : ownerId,
    start_date: f.start_date,
    end_date: f.end_date,
  };
};

const Project = {
  async list() {
    await loadUsers();
    const { data } = await apiClient.get('/api/gantt/projects');
    return (Array.isArray(data) ? data : []).map(toProject);
  },

  async update(id, fields) {
    await apiClient.put(`/api/gantt/projects/${id}`, await projectPayload(fields));
  },

  async create(fields) {
    const { data } = await apiClient.post('/api/gantt/projects', await projectPayload(fields));
    return { ...fields, id: str(data.id) };
  },

  async delete(id) {
    await apiClient.delete(`/api/gantt/projects/${id}`);
  },
};

// Owner photos have no backend storage yet: keep them as data URLs for the current session.
const UploadPublicFile = ({ file }) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ file_url: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const base44 = {
  entities: { Project, ScheduleItem },
  integrations: { Core: { UploadPublicFile } },
};
