import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import { getAuditLogs, exportAuditCsv, getAuditSummary } from '../../../api/audit';
import { sanitizeCsvCell } from '../../../utils/csvUtils';

const ACTION_META = {
  USER_LOGIN:           { label: 'User Login', color: 'bg-cyan-100 text-cyan-800' },
  USER_LOGOUT:          { label: 'User Logout', color: 'bg-purple-100 text-purple-800' },
  LOGIN_FAILED:         { label: 'Login Failed', color: 'bg-rose-100 text-rose-800' },
  TOKEN_REUSE_DETECTED: { label: 'Token Reuse Alert', color: 'bg-red-100 text-red-800' },
  USER_REGISTERED:      { label: 'User Registered', color: 'bg-blue-100 text-blue-800' },
  USER_APPROVED:        { label: 'User Approved', color: 'bg-emerald-100 text-emerald-800' },
  USER_ADDED:           { label: 'User Added', color: 'bg-teal-100 text-teal-800' },
  USER_ROLE_CHANGED:    { label: 'Role Changed', color: 'bg-indigo-100 text-indigo-800' },
  USER_STATUS_CHANGED:  { label: 'Status Changed', color: 'bg-amber-100 text-amber-800' },
  USER_DEACTIVATED:     { label: 'User Deactivated', color: 'bg-rose-100 text-rose-800' },
  PASSWORD_RESET:       { label: 'Password Reset', color: 'bg-amber-100 text-amber-800' },
  DOCUMENT_CREATED:     { label: 'Document Created', color: 'bg-emerald-100 text-emerald-800' },
  DOCUMENT_UPDATED:     { label: 'Document Updated', color: 'bg-sky-100 text-sky-800' },
  DOCUMENT_DELETED:     { label: 'Document Deleted', color: 'bg-rose-100 text-rose-800' },
  DOCUMENT_REVIEWED:    { label: 'Document Reviewed', color: 'bg-slate-100 text-slate-800' },
  DOCUMENT_APPROVED:    { label: 'Document Approved', color: 'bg-amber-100 text-amber-800' },
  DOCUMENT_REJECTED:    { label: 'Document Rejected', color: 'bg-orange-100 text-orange-800' },
  DOCUMENT_STATUS_CHANGED: { label: 'Doc Status Changed', color: 'bg-indigo-100 text-indigo-800' },
  DOCUMENT_REASSIGNED:  { label: 'Doc Reassigned', color: 'bg-violet-100 text-violet-800' },
  DOCUMENT_PUBLISHED:   { label: 'Document Published', color: 'bg-lime-100 text-lime-800' },
  TEMPLATE_CREATED:     { label: 'Template Created', color: 'bg-emerald-100 text-emerald-800' },
  TEMPLATE_UPDATED:     { label: 'Template Updated', color: 'bg-sky-100 text-sky-800' },
  TEMPLATE_DELETED:     { label: 'Template Deleted', color: 'bg-rose-100 text-rose-800' },
  TEMPLATE_REVIEWED:    { label: 'Template Reviewed', color: 'bg-slate-100 text-slate-800' },
  TEMPLATE_APPROVED:    { label: 'Template Approved', color: 'bg-amber-100 text-amber-800' },
  TEMPLATE_REJECTED:    { label: 'Template Rejected', color: 'bg-orange-100 text-orange-800' },
  TEMPLATE_STATUS_CHANGED: { label: 'Tpl Status Changed', color: 'bg-indigo-100 text-indigo-800' },
  TEMPLATE_PUBLISHED:   { label: 'Template Published', color: 'bg-lime-100 text-lime-800' },
  AI_SUMMARY_GENERATED: { label: 'AI Summary Generated', color: 'bg-fuchsia-100 text-fuchsia-800' },
  DEPARTMENT_CREATED:   { label: 'Dept Created', color: 'bg-teal-100 text-teal-800' },
  DEPARTMENT_UPDATED:   { label: 'Dept Updated', color: 'bg-teal-100 text-teal-800' },
  SITE_CREATED:         { label: 'Site Created', color: 'bg-cyan-100 text-cyan-800' },
  SITE_UPDATED:         { label: 'Site Updated', color: 'bg-cyan-100 text-cyan-800' },
  ATTACHMENT_UPLOADED:  { label: 'Attachment Uploaded', color: 'bg-blue-100 text-blue-800' },
  ATTACHMENT_DELETED:   { label: 'Attachment Deleted', color: 'bg-rose-100 text-rose-800' },
  ORGANIZATION_REGISTERED: { label: 'Org Registered', color: 'bg-purple-100 text-purple-800' }
};

const getActionMeta = (action) => {
  if (!action) return { label: 'Unknown', color: 'bg-slate-100 text-slate-800' };
  const upper = action.toUpperCase();
  return ACTION_META[upper] || { label: action.replace(/_/g, ' '), color: 'bg-slate-100 text-slate-800' };
};

const resolveAuditUser = (record) => {
  const name = (record.user_name && record.user_name !== 'System' ? record.user_name : null) ||
               (record.name && record.name !== 'System' ? record.name : null) ||
               [record.first_name, record.last_name].filter(Boolean).join(' ').trim() ||
               record.user_email ||
               record.email ||
               (record.user_id ? `User #${record.user_id}` : 'System');

  const email = record.user_email || record.email || (record.user_id ? `ID: ${record.user_id}` : '—');
  return { name, email };
};

const resolveAuditItem = (record, details) => {
  const resourceType = String(record.resource_type || (record.document_id ? 'document' : 'system')).toLowerCase();
  const resourceId = record.resource_id || record.document_id;
  const title = details.title || details.name || details.templateName || details.documentTitle || details.fileName || record.document_title || record.template_name;

  if (resourceType === 'document') {
    return {
      type: 'Document',
      name: title || (resourceId ? 'Document' : '—'),
      id: resourceId ? `ID: ${String(resourceId).slice(0, 8)}…` : '—',
      fullId: resourceId
    };
  }

  if (resourceType === 'template') {
    return {
      type: 'Template',
      name: title || (resourceId ? 'Template' : '—'),
      id: resourceId ? `ID: ${String(resourceId).slice(0, 8)}…` : '—',
      fullId: resourceId
    };
  }

  if (resourceType === 'user') {
    return {
      type: 'User',
      name: details.targetEmail || details.approvedEmail || details.email || (resourceId ? `User #${resourceId}` : '—'),
      id: resourceId ? `ID: ${resourceId}` : '—',
      fullId: resourceId
    };
  }

  if (resourceType === 'department') {
    return {
      type: 'Department',
      name: details.name || (resourceId ? `Department #${resourceId}` : '—'),
      id: resourceId ? `ID: ${resourceId}` : '—',
      fullId: resourceId
    };
  }

  if (resourceType === 'site') {
    return {
      type: 'Site',
      name: details.name || (resourceId ? `Site #${resourceId}` : '—'),
      id: resourceId ? `ID: ${resourceId}` : '—',
      fullId: resourceId
    };
  }

  if (resourceType === 'attachment') {
    return {
      type: 'Attachment',
      name: details.fileName || (resourceId ? `Attachment #${resourceId}` : '—'),
      id: resourceId ? `ID: ${resourceId}` : '—',
      fullId: resourceId
    };
  }

  if (resourceType === 'auth' || resourceType === 'organization') {
    return {
      type: 'Auth',
      name: details.name || details.attemptedEmail || 'Authentication',
      id: resourceId ? `ID: ${resourceId}` : '—',
      fullId: resourceId
    };
  }

  return {
    type: resourceType,
    name: title || (resourceId ? `${resourceType} #${resourceId}` : '—'),
    id: resourceId ? `ID: ${resourceId}` : '—',
    fullId: resourceId
  };
};

const getStatusBadge = (status) => {
  const s = String(status || 'success').toLowerCase();
  if (s === 'failure' || s === 'failed') {
    return { label: 'FAILURE', color: 'bg-rose-100 text-rose-800 border-rose-200' };
  }
  if (s === 'denied') {
    return { label: 'DENIED', color: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  return { label: 'SUCCESS', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
};

const friendlyKey = (key) => {
  const map = {
    title: 'Document Title',
    name: 'Template Name',
    status: 'Status',
    email: 'Email',
    userEmail: 'User Email',
    comment: 'Comment',
    templateId: 'Template ID',
    templateName: 'Template Name',
    note: 'Note',
    raw: 'Details',
  };
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
};

const parseDetails = (details) => {
  if (!details) return {};
  if (typeof details === 'object') return details;
  try {
    return JSON.parse(details);
  } catch {
    return { raw: String(details) };
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const headerDefinitions = [
  { key: 'created_at', label: 'Timestamp', width: 'w-[18%]' },
  { key: 'user', label: 'User', width: 'w-[16%]' },
  { key: 'action_type', label: 'Action', width: 'w-[18%]' },
  { key: 'item', label: 'Item', width: 'w-[16%]' },
  { key: 'ip_address', label: 'IP Address', width: 'w-[12%]' },
  { key: 'status', label: 'Status / Details', width: 'w-[20%]' },
];

const defaultAuditSummary = {
  summary: {
    total_actions: 0,
    actions_last_7_days: 0,
    actions_last_30_days: 0,
  },
  topUsers: [],
  topActions: [],
  topItems: [],
};

const AuditTrailPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionType, setActionType] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // UI state for collapsible reports and contextual filters
  const [showReports, setShowReports] = useState(false);
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [showActionFilter, setShowActionFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [auditSummary, setAuditSummary] = useState(defaultAuditSummary);
  const [fetchError, setFetchError] = useState(null);

  const buildFilters = useCallback(() => ({
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(actionType ? { actionType } : {}),
    ...(userFilter ? { userId: userFilter } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }), [searchTerm, actionType, userFilter, startDate, endDate]);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const filters = buildFilters();
      const [logsResponse, summaryResponse] = await Promise.all([
        getAuditLogs(filters),
        getAuditSummary(filters),
      ]);

      setAuditLogs((logsResponse && logsResponse.data) ? logsResponse.data : (logsResponse || []));
      setAuditSummary((summaryResponse && summaryResponse.data) ? summaryResponse.data : (summaryResponse || defaultAuditSummary));
    } catch (error) {
      console.error('Failed to fetch audit data', error);
      setAuditLogs([]);
      setAuditSummary(defaultAuditSummary);
      setFetchError(error);
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const sortedLogs = useMemo(() => {
    if (!auditLogs) return [];
    const sorted = [...auditLogs];
    sorted.sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      if (sortField === 'created_at') {
        return new Date(aValue) - new Date(bValue);
      }
      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
    });
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [auditLogs, sortField, sortDirection]);

  const visibleLogs = useMemo(() => sortedLogs, [sortedLogs]);

  const actionTypes = useMemo(() => {
    const values = new Set();
    auditLogs.forEach((log) => log.action_type && values.add(log.action_type));
    return Array.from(values).sort();
  }, [auditLogs]);

  const userOptions = useMemo(() => {
    const users = new Map();
    auditLogs.forEach((log) => {
      const name = [log.first_name, log.last_name].filter(Boolean).join(' ').trim() || `User #${log.user_id}`;
      if (log.user_id) users.set(log.user_id, name);
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [auditLogs]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionType('');
    setUserFilter('');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCsv = async () => {
    try {
      const rows = visibleLogs || [];
      const headers = ['Timestamp', 'User', 'Action', 'Item', 'IP Address', 'Status/Details'];
      const csvRows = [headers.join(',')];

      rows.forEach((r) => {
        const timestamp = formatDate(r.created_at);
        const userName = [r.first_name, r.last_name].filter(Boolean).join(' ') || 'System';
        const actionLabel = getActionMeta(r.action_type).label;
        const itemName = r.document_title || r.template_name || r.document_id || '';
        const ip = r.ip_address || '';
        const details = (() => {
          try {
            const d = parseDetails(r.details);
            const status = d.status || d.stage || '';
            const extra = Object.keys(d).filter((k) => k !== 'status').map((k) => `${friendlyKey(k)}: ${String(d[k])}`).join(' | ');
            return [status, extra].filter(Boolean).join(' - ');
          } catch (e) {
            return '';
          }
        })();

        const safe = [timestamp, userName, actionLabel, itemName, ip, details].map(sanitizeCsvCell);
        csvRows.push(safe.join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit_trail_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export CSV failed', error);
    }
  };

  return (
    <MainLayout showSearch={false}>
      <div className="max-w-container_max_width mx-auto pb-8">
        <div className="mb-6 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-on-surface">Audit Trail</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Full immutable audit stream tracking who did what, when, to which resource, with what result.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowReports((s) => !s)}
                className="inline-flex items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high/80 transition"
              >
                {showReports ? 'Hide Metrics' : 'Show Metrics'}
              </button>
              <button
                type="button"
                onClick={fetchAuditLogs}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition"
              >
                Refresh Stream
              </button>
            </div>
          </div>

          {showReports && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-outline-variant bg-surface-container-high/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Total Recorded Events</div>
                <div className="mt-2 text-2xl font-bold text-on-surface">{auditSummary.summary.total_actions}</div>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-surface-container-high/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Last 7 Days</div>
                <div className="mt-2 text-2xl font-bold text-on-surface">{auditSummary.summary.actions_last_7_days}</div>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-surface-container-high/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Last 30 Days</div>
                <div className="mt-2 text-2xl font-bold text-on-surface">{auditSummary.summary.actions_last_30_days}</div>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold uppercase text-on-surface-variant">Search Events</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search action, user, or details..."
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface shadow-sm focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-on-surface-variant">Filter by Action</span>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface shadow-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="">All Actions</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>
                    {getActionMeta(type).label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-on-surface-variant">Filter by User</span>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface shadow-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="">All Users</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-on-surface-variant">Adjust filters to narrow the audit stream. Click any header to sort.</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center rounded-2xl border border-outline-variant bg-background px-4 py-2 text-sm font-semibold text-on-surface transition hover:border-blue-600 hover:text-blue-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className="bg-surface-container-high border-b border-outline-variant">
              <tr>
                {headerDefinitions.map((header) => (
                  <th
                    key={header.key}
                    className={`${header.width} px-4 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant select-none`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{header.label}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSort(header.key); }}
                        aria-label={`Sort by ${header.label}`}
                        className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-high hover:bg-surface-container-high/80 text-on-surface-variant"
                      >
                        <span className="text-sm font-bold">
                          {sortField === header.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={headerDefinitions.length} className="px-4 py-10 text-center text-sm text-on-surface-variant">Loading audit records…</td>
                </tr>
              ) : visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={headerDefinitions.length} className="px-4 py-10 text-center text-sm text-on-surface-variant">No audit records found.</td>
                </tr>
              ) : (
                visibleLogs.map((record) => {
                  const user = resolveAuditUser(record);
                  const details = parseDetails(record.details);
                  const item = resolveAuditItem(record, details);
                  const statusBadge = getStatusBadge(record.status || details.status);
                  const extraKeys = Object.keys(details).filter((key) => !['status', 'password', 'token', 'secret'].includes(key));

                  return (
                    <tr key={record.id || `${record.created_at}-${record.user_id}`} className="border-b border-outline-variant last:border-none hover:bg-surface-container-high/40 transition">
                      <td className="px-4 py-4 align-top text-sm text-on-surface whitespace-nowrap">{formatDate(record.created_at)}</td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface">
                        <div className="font-semibold text-sm text-on-surface">{user.name}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">{user.email}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getActionMeta(record.action_type).color}`}>
                          {getActionMeta(record.action_type).label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface">
                        <div className="font-semibold text-sm text-on-surface">{item.name}</div>
                        <div className="mt-1 text-xs text-on-surface-variant font-mono">
                          {item.id}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface font-mono">{record.ip_address || '—'}</td>
                      <td className="px-4 py-4 align-top text-sm text-on-surface">
                        <div className="mb-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        {extraKeys.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                            {extraKeys.slice(0, 3).map((key) => (
                              <div key={key}>
                                <span className="font-semibold text-on-surface">{friendlyKey(key)}:</span> {String(details[key])}
                              </div>
                            ))}
                            {extraKeys.length > 3 && <div>+{extraKeys.length - 3} more...</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditTrailPage;
