import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import { useAuth } from '../../../utils/authService';
import apiClient from '../../../api/apiClient';
import { buildCsvFromDocumentContent } from '../../../utils/taskDocumentUtils';

const tabs = ['My Tasks', 'Sent Tasks'];
const filters = ['All', 'Pending', 'Completed'];
const statusOptions = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];
const defaultForm = { title: '', description: '', start_date: '', due_date: '', priority: 'medium', assigned_to: '', document_id: null, depends_on: '' };

const formatTaskDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
};

const normalizeTaskStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (['completed', 'done', 'complete'].includes(status)) return 'completed';
  if (['in progress', 'in_progress', 'progress', 'active'].includes(status)) return 'in_progress';
  return 'not_started';
};

const getStatusLabel = (status) => {
  const normalized = normalizeTaskStatus(status);
  return statusOptions.find((option) => option.value === normalized)?.label || 'Not Started';
};

const getStatusBadgeClasses = (status) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (normalized === 'in_progress') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};

export default function MyTasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('My Tasks');
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [dependencyOptions, setDependencyOptions] = useState([]);
  const [formError, setFormError] = useState('');
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState([]);

  const currentUserId = user?.id || user?.userId;

  const loadTasks = async (nextSearch = searchQuery) => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      const endpoint = activeTab === 'Sent Tasks' ? '/api/tasks/sent' : '/api/tasks/my-tasks';
      const params = {};
      if (nextSearch && typeof nextSearch === 'string' && nextSearch.trim()) {
        params.search = nextSearch.trim();
      }
      const response = await apiClient.get(endpoint, { params });
      const raw = response.data;
      const tasksArray = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      setTasks(tasksArray);
    } catch (error) {
      console.error('Failed to load tasks', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTasks(searchQuery);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, searchQuery, currentUserId]);

  useEffect(() => {
    if (!showModal || !currentUserId) return;
    const loadModalData = async () => {
      try {
        setIsModalLoading(true);
        const [usersResponse, docsResponse, dependencyResponse] = await Promise.all([
          apiClient.get('/api/users').catch(() => apiClient.get(`/api/org_members/${currentUserId}`)),
          apiClient.get('/api/documents').catch(() => apiClient.get('/api/all-docs')),
          apiClient.get('/api/tasks/gantt').catch(() => ({ data: [] })),
        ]);
        const usersData = Array.isArray(usersResponse?.data) ? usersResponse.data : (usersResponse?.data?.data || []);
        const docsData = Array.isArray(docsResponse?.data) ? docsResponse.data : (docsResponse?.data?.data || []);
        const dependencyData = Array.isArray(dependencyResponse?.data) ? dependencyResponse.data : [];
        setUsers(usersData);
        setDocuments(docsData);
        setDependencyOptions(dependencyData);
      } catch (error) {
        console.error('Failed to load modal options', error);
        setUsers([]);
        setDocuments([]);
        setDependencyOptions([]);
      } finally {
        setIsModalLoading(false);
      }
    };

    loadModalData();
  }, [showModal, currentUserId]);

  useEffect(() => {
    if (!selectedTask) return;
    const stillExists = tasks.some((task) => task.id === selectedTask.id);
    if (!stillExists) {
      setSelectedTask(null);
      setComments([]);
    }
  }, [selectedTask, tasks]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const status = normalizeTaskStatus(task.status);
      const matchesFilter = filter === 'Pending' ? status !== 'completed' : filter === 'Completed' ? status === 'completed' : true;
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      const searchableText = [
        task.title,
        task.description,
        `${task.created_by_first_name || ''} ${task.created_by_last_name || ''}`,
        `${task.assigned_to_first_name || ''} ${task.assigned_to_last_name || ''}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [filter, searchQuery, tasks]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setFilter('All');
    setRecentlyCompletedIds([]);
  };

  const openTask = async (task) => {
    setSelectedTask(task);
    try {
      const response = await apiClient.get(`/api/tasks/${task.id}/comments`);
      const commentsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setComments(commentsData);
    } catch (error) {
      console.error('Failed to load comments', error);
      setComments([]);
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!form.title?.trim()) return;
    if (form.start_date && form.due_date && form.start_date > form.due_date) {
      setFormError('The start date cannot be after the due date.');
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      const normalizedDocumentId = form.document_id && String(form.document_id).trim() ? String(form.document_id).trim() : null;
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() || '',
        created_by: currentUserId,
        assigned_to: form.assigned_to || currentUserId,
        document_id: normalizedDocumentId,
        start_date: form.start_date || null,
        depends_on: form.depends_on ? [Number(form.depends_on)] : [],
      };
      await apiClient.post('/api/tasks', payload);
      setShowModal(false);
      setForm(defaultForm);
      await loadTasks();
    } catch (error) {
      console.error('Failed to create task', error);
      setFormError(error.response?.data?.error || 'Could not create the task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (event) => {
    event.preventDefault();
    if (!selectedTask || !commentDraft.trim()) return;
    try {
      await apiClient.post(`/api/tasks/${selectedTask.id}/comments`, { message: commentDraft.trim() });
      setCommentDraft('');
      const response = await apiClient.get(`/api/tasks/${selectedTask.id}/comments`);
      setComments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to add comment', error);
    }
  };

  const handleOpenDocumentPreview = async (task) => {
    if (!task?.document_id) return;
    try {
      setPreviewLoading(true);
      const response = await apiClient.get(`/api/documents/${task.document_id}`);
      setPreviewDocument(response.data || null);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error('Failed to load document preview', error);
      setPreviewDocument(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadCsv = async (task) => {
    if (!task?.document_id) return;
    try {
      const response = await apiClient.get(`/api/documents/${task.document_id}`);
      const documentData = response.data || {};
      const csvContent = buildCsvFromDocumentContent(documentData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `${(documentData.title || task.document_title || 'document').replace(/\s+/g, '_') || 'document'}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export document as CSV', error);
    }
  };

  const handleUpdateTaskStatus = async (task, nextStatus) => {
    if (!task?.id) return;
    const currentStatus = normalizeTaskStatus(task.status);
    if (currentStatus === nextStatus) return;

    try {
      await apiClient.patch(`/api/tasks/${task.id}`, { status: nextStatus });
      setTasks((currentTasks) =>
        currentTasks.map((entry) => (entry.id === task.id ? { ...entry, status: nextStatus } : entry))
      );
      setSelectedTask((currentTask) => (currentTask?.id === task.id ? { ...currentTask, status: nextStatus } : currentTask));
      if (nextStatus === 'completed') {
        setRecentlyCompletedIds((currentIds) => (currentIds.includes(task.id) ? currentIds : [...currentIds, task.id]));
      } else {
        setRecentlyCompletedIds((currentIds) => currentIds.filter((id) => id !== task.id));
      }
    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  return (
    <MainLayout showSearch={false}>
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">Task Manager</h1>
            <p className="text-sm text-on-surface-variant">Coordinate tasks between you and your team without leaving the workspace.</p>
          </div>
          <button
            onClick={() => {
              setFormError('');
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <span className="material-symbols-outlined mr-2 text-base">add</span>
            New Task
          </button>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-blue-700 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  filter === option
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option}
                {option === 'Completed' && recentlyCompletedIds.length > 0 ? <span className="ml-2 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm">
              <label className="relative block">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant">search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tasks"
                  className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high pl-10 pr-3 text-sm text-on-surface outline-none focus:border-blue-700"
                />
              </label>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant">Loading tasks…</div>
            ) : visibleTasks.length === 0 ? (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
                {tasks.length === 0 ? 'No tasks yet. Create one to get started.' : 'No tasks match your current search or filter.'}
              </div>
            ) : (
              visibleTasks.map((task) => {
                const normalizedStatus = normalizeTaskStatus(task.status);
                const isRecentlyCompleted = recentlyCompletedIds.includes(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => openTask(task)}
                    className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-sm transition hover:border-blue-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-on-surface">{task.title || 'Untitled task'}</div>
                          {isRecentlyCompleted ? <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label="Newly completed" /> : null}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                          {task.description || 'No description provided.'}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(normalizedStatus)}`}>
                          {getStatusLabel(normalizedStatus)}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                          {task.priority || 'medium'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-on-surface-variant">
                      {task.start_date ? <span>Start: {formatTaskDate(task.start_date)}</span> : null}
                      <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                      <span>{activeTab === 'Sent Tasks' ? `To: ${task.assigned_to_first_name || 'Team'} ${task.assigned_to_last_name || ''}`.trim() : `From: ${task.created_by_first_name || ''} ${task.created_by_last_name || ''}`.trim()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            {selectedTask ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Task details</div>
                  <h2 className="mt-2 text-xl font-semibold text-on-surface">{selectedTask.title || 'Untitled task'}</h2>
                  <p className="mt-2 text-sm text-on-surface-variant">{selectedTask.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-xl border border-outline-variant bg-surface-container-high p-3">
                  <div className="text-sm font-semibold text-on-surface">Status</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {statusOptions.map((option) => {
                      const isActive = normalizeTaskStatus(selectedTask.status) === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleUpdateTaskStatus(selectedTask, option.value)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-blue-700 text-white' : 'bg-white text-on-surface-variant'}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-on-surface-variant">
                  <div><span className="font-semibold text-on-surface">Status:</span> {getStatusLabel(selectedTask.status)}</div>
                  <div><span className="font-semibold text-on-surface">Start date:</span> {formatTaskDate(selectedTask.start_date) || 'Not set'}</div>
                  <div><span className="font-semibold text-on-surface">Due date:</span> {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No due date'}</div>
                  {selectedTask.progress !== undefined && selectedTask.progress !== null ? (
                    <div><span className="font-semibold text-on-surface">Progress:</span> {selectedTask.progress}%</div>
                  ) : null}
                  <div><span className="font-semibold text-on-surface">Sender:</span> {`${selectedTask.created_by_first_name || ''} ${selectedTask.created_by_last_name || ''}`.trim() || 'Unknown'}</div>
                  <div><span className="font-semibold text-on-surface">Receiver:</span> {`${selectedTask.assigned_to_first_name || ''} ${selectedTask.assigned_to_last_name || ''}`.trim() || 'Unassigned'}</div>
                </div>
                <div className="rounded-xl border border-outline-variant bg-surface-container-high p-3">
                  <div className="text-sm font-semibold text-on-surface">Related Document</div>
                  {selectedTask.document_id ? (
                    <>
                      <div className="mt-1 text-sm text-on-surface-variant">{selectedTask.document_title || 'Attached document'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleOpenDocumentPreview(selectedTask)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
                          {previewLoading ? 'Loading…' : 'View Document'}
                        </button>
                        <button type="button" onClick={() => handleDownloadCsv(selectedTask)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface">
                          Download CSV
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-sm text-on-surface-variant">None</div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-on-surface">Reply thread</div>
                  <form onSubmit={handleAddComment} className="mt-2 space-y-2">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows="3"
                      className="w-full rounded-xl border border-outline-variant bg-white p-3 text-sm"
                      placeholder="Leave a reply to keep both parties aligned"
                    />
                    <button type="submit" className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Reply</button>
                  </form>
                  <div className="mt-3 space-y-2">
                    {comments.length === 0 ? (
                      <div className="text-sm text-on-surface-variant">No replies yet.</div>
                    ) : comments.map((comment) => (
                      <div key={comment.id} className="rounded-xl bg-surface-container-high p-3 text-sm">
                        <div className="font-semibold text-on-surface">{`${comment.first_name || 'User'} ${comment.last_name || ''}`.trim()}</div>
                        <div className="mt-1 text-on-surface-variant">{comment.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-on-surface-variant">Select a task to view its description, due date, and replies.</div>
            )}
          </div>
        </div>

        {isPreviewOpen && previewDocument && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-on-surface">{previewDocument.title || 'Document Preview'}</h3>
                <button onClick={() => setIsPreviewOpen(false)} className="text-sm text-on-surface-variant">Close</button>
              </div>
              <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-outline-variant bg-surface-container-high p-4 text-sm whitespace-pre-wrap text-on-surface-variant">
                {(() => {
                  const content = previewDocument.content || previewDocument.document_content || '';
                  if (typeof content === 'string') {
                    return content;
                  }
                  return JSON.stringify(content, null, 2);
                })()}
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-on-surface">Create new task</h3>
                <button onClick={() => setShowModal(false)} className="text-sm text-on-surface-variant">Close</button>
              </div>
              <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="w-full rounded-xl border border-outline-variant p-3"
                  placeholder="Task title"
                />
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="w-full rounded-xl border border-outline-variant p-3"
                  placeholder="Task description"
                  rows="3"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-on-surface">
                    <span className="mb-1 block">Start date</span>
                    <input
                      type="date"
                      value={form.start_date}
                      max={form.due_date || undefined}
                      onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                      className="w-full rounded-xl border border-outline-variant p-3"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-on-surface">
                    <span className="mb-1 block">Due date</span>
                    <input
                      type="date"
                      value={form.due_date}
                      min={form.start_date || undefined}
                      onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                      className="w-full rounded-xl border border-outline-variant p-3"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-on-surface">
                    <span className="mb-1 block">Priority</span>
                    <select
                      value={form.priority}
                      onChange={(event) => setForm({ ...form, priority: event.target.value })}
                      className="w-full rounded-xl border border-outline-variant p-3"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-on-surface">
                    <span className="mb-1 block">Starts after (optional)</span>
                    <select
                      aria-label="Starts after"
                      value={form.depends_on}
                      onChange={(event) => setForm({ ...form, depends_on: event.target.value })}
                      className="w-full rounded-xl border border-outline-variant p-3"
                      disabled={isModalLoading}
                    >
                      <option value="">No dependency</option>
                      {dependencyOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title || `Task ${option.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-semibold text-on-surface">
                  <span className="mb-1 block">Assign To</span>
                  <select
                    aria-label="Assign to"
                    value={form.assigned_to || user?.id || ''}
                    onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
                    className="w-full rounded-xl border border-outline-variant p-3"
                    disabled={isModalLoading}
                  >
                    <option value={user?.id || ''}>Me</option>
                    {users
                      .filter((candidate) => String(candidate.id) !== String(user?.id))
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.first_name || candidate.name || candidate.email} {candidate.last_name || ''} ({candidate.email || 'No email'})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-on-surface">
                  <span className="mb-1 block">Related Document</span>
                  <select
                    aria-label="Related document"
                    value={form.document_id || ''}
                    onChange={(event) => setForm({ ...form, document_id: event.target.value || null })}
                    className="w-full rounded-xl border border-outline-variant p-3"
                    disabled={isModalLoading}
                  >
                    <option value="">None</option>
                    {documents.map((document) => (
                      <option key={document.document_id || document.id} value={document.document_id || document.id}>
                        {document.title || document.name || document.document_id || document.id}
                      </option>
                    ))}
                  </select>
                </label>
                {formError ? (
                  <div role="alert" className="rounded-xl border border-error-container bg-error-container/40 px-3 py-2 text-sm text-on-error-container">
                    {formError}
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
                    {submitting ? 'Creating…' : 'Create task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
