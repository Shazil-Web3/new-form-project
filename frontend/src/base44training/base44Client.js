// Adapter: exposes the slice of the Base44 SDK used by the copied SkillStream admin screens
// (base44.entities.*, base44.auth.me, base44.users.inviteUser, base44.integrations.Core.UploadPublicFile)
// and maps it onto this app's backend (generic entity store in backend/training/b44Entities.js).
import apiClient, { API_BASE_URL } from '../api/apiClient';

const ENTITY_BASE = '/api/b44/entities';

const sortAndLimit = (sortOrOpts, limit) => {
  if (sortOrOpts && typeof sortOrOpts === 'object') return { sort: sortOrOpts.sort, limit: sortOrOpts.limit, skip: sortOrOpts.skip };
  return { sort: sortOrOpts, limit };
};

// Same operators as the backend ($in, $ne, $or ...), used only for the User entity which lives in the users table.
const matchesUser = (u, query) => {
  if (!query) return true;
  return Object.entries(query).every(([key, cond]) => {
    if (key === '$or') return (cond || []).some((q) => matchesUser(u, q));
    const v = u[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond) return cond.$in.map(String).includes(String(v));
      if ('$ne' in cond) return String(v ?? '') !== String(cond.$ne ?? '');
      return true;
    }
    return String(v ?? '') === String(cond ?? '');
  });
};

const TRAINING_ROLE = { admin: 'administrator', manager: 'manager', employee: 'employee' };

const userEntity = {
  async list() {
    const { data } = await apiClient.get('/api/b44/users');
    return data;
  },
  async filter(query) {
    const { data } = await apiClient.get('/api/b44/users');
    return data.filter((u) => matchesUser(u, query));
  },
  async get(id) {
    const { data } = await apiClient.get('/api/b44/users');
    return data.find((u) => String(u.id) === String(id)) || null;
  },
  async update(id, fields) {
    if (fields.role !== undefined) await apiClient.put(`/api/training/users/${id}/role`, { role: TRAINING_ROLE[fields.role] || fields.role });
    if (fields.manager_id !== undefined) await apiClient.put(`/api/training/users/${id}/manager`, { managerId: fields.manager_id || null });
    return { id, ...fields };
  },
};

const makeEntity = (name) => {
  const url = `${ENTITY_BASE}/${name}`;
  return {
    list: async (sort, limit) => (await apiClient.post(`${url}/query`, { sort, limit })).data,
    filter: async (query, sortOrOpts, limit) => (await apiClient.post(`${url}/query`, { query, ...sortAndLimit(sortOrOpts, limit) })).data,
    get: async (id) => (await apiClient.get(`${url}/${id}`)).data,
    create: async (data) => (await apiClient.post(url, data)).data,
    update: async (id, data) => (await apiClient.put(`${url}/${id}`, data)).data,
    delete: async (id) => (await apiClient.delete(`${url}/${id}`)).data,
    bulkCreate: async (items) => (await apiClient.post(`${url}/bulk`, { items })).data,
    bulkUpdate: async (items) => (await apiClient.post(`${url}/bulk-update`, { items })).data,
    updateMany: async (query, update) => (await apiClient.post(`${url}/update-many`, { query, update })).data,
    deleteMany: async (query) => (await apiClient.post(`${url}/delete-many`, { query })).data,
    count: async (query) => (await apiClient.post(`${url}/count`, { query })).data.count,
    aggregate: async ({ query, groupBy } = {}) => (await apiClient.post(`${url}/aggregate`, { query, groupBy })).data,
  };
};

const entityCache = {};
const entities = new Proxy({}, {
  get(_, name) {
    if (typeof name !== 'string') return undefined;
    if (name === 'User') return userEntity;
    if (!entityCache[name]) entityCache[name] = makeEntity(name);
    return entityCache[name];
  },
});

export const base44 = {
  entities,
  auth: {
    me: async () => (await apiClient.get('/api/b44/me')).data,
    logout: async () => {},
    isAuthenticated: async () => true,
  },
  classes: {
    // Time-spent heartbeat (seconds, capped on the server) used by the Reports page.
    logTime: async (classId, seconds) => (await apiClient.post(`/api/b44/classes/${classId}/time`, { seconds })).data,
    // Rate a completed class (1-5). Returns { success, rating }.
    rate: async (classId, rating) => (await apiClient.post(`/api/b44/classes/${classId}/rating`, { rating })).data,
  },
  documents: {
    // Published documents from the Documents module (for the "Linked Document" class type; staff only).
    published: async () => (await apiClient.get('/api/b44/documents/published')).data,
    // Current published version of a linked document: { id, title, version, updated_at } or null.
    latest: async (documentId) => (await apiClient.get(`/api/b44/documents/${documentId}/latest`)).data,
  },
  quiz: {
    // Server-side grading: returns { score, passed, correct, total, passing_score }.
    submit: async (classId, answers) => (await apiClient.post(`/api/b44/quiz/${classId}/submit`, { answers })).data,
  },
  users: {
    inviteUser: async (email, role) => (await apiClient.post('/api/training/users/invite', { email, role: TRAINING_ROLE[role] || role })).data,
  },
  integrations: {
    Core: {
      UploadPublicFile: async ({ file }) => {
        const form = new FormData();
        form.append('file', file);
        const { data } = await apiClient.post('/api/b44/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return { file_url: `${API_BASE_URL}${data.file_url}`, file_name: data.file_name };
      },
    },
  },
};

export default base44;
