/**
 * @file dashboardUtils.js
 * @description Helper functions and formatters for the Unified Dashboard
 * @dependencies none
 * @author Codegen
 */

export const getDisplayCategory = (item) => {
  if (item.category) {
    const cat = String(item.category).toLowerCase();
    if (cat.includes('hr') || cat.includes('human')) return 'Human Resources';
    if (cat.includes('finance') || cat.includes('fin')) return 'Finance';
    if (cat.includes('qa') || cat.includes('quality')) return 'Quality Assurance';
    if (cat.includes('legal') || cat.includes('compliance')) return 'Legal & Compliance';
    if (cat.includes('eng') || cat.includes('engineering')) return 'Engineering';
    return item.category;
  }
  const code = String(item.id).charCodeAt(0) || 0;
  return code % 3 === 0 ? 'Human Resources' : code % 3 === 1 ? 'Finance' : 'Legal & Compliance';
};

export const getMockedDueDate = (item) => {
  if (item.due_date) return item.due_date;
  const cat = getDisplayCategory(item).toLowerCase();
  const date = new Date();
  if (cat.includes('hr')) date.setDate(date.getDate() + 5);
  else if (cat.includes('fin')) date.setDate(date.getDate() + 2);
  else date.setDate(date.getDate() - 1);
  return date.toISOString();
};

export const getApproversForTemplate = (t) => {
  try {
    const raw = t.template_approvers || t.approvers;
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    const reviewers = parsed.reviewers || [];
    const approvers = parsed.approvers || [];
    const s = String(t?.status || '').toLowerCase();
    // When in review phase, show reviewers; don't show old rejected approvers
    if (s === 'pending_review' || s === 'reviewed') {
      return reviewers.map(r => ({ ...r, role: 'REVIEW' }));
    }
    return [...reviewers.map(r => ({ ...r, role: 'REVIEW' })), ...approvers.map(a => ({ ...a, role: 'APPROVER' }))];
  } catch {
    return [];
  }
};

export const getApproversForDoc = (d) => {
  try {
    const raw = d.approvers || d.template_approvers;
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    const reviewers = parsed.reviewers || [];
    const approvers = parsed.approvers || [];
    const s = String(d?.status || '').toLowerCase();
    // When in review phase, show reviewers; don't show old rejected approvers
    if (s === 'pending_review' || s === 'reviewed') {
      return reviewers.map(r => ({ ...r, role: 'REVIEW' }));
    }
    return [...reviewers.map(r => ({ ...r, role: 'REVIEW' })), ...approvers.map(a => ({ ...a, role: 'APPROVER' }))];
  } catch {
    return [];
  }
};

/**
 * Resolves the "received_at" timestamp for the current user.
 * - If current user is the author/creator, returns null (column shows '-' / empty for author).
 * - If current user is an assigned reviewer or approver, returns their received timestamp.
 * - If admin/pm viewing, returns when it was submitted/assigned.
 */
export const getReceivedAt = (item, currentUser) => {
  if (!item || !currentUser) return null;

  const currentUserId = currentUser.id ?? currentUser.userId;
  const isAuthor = currentUserId !== undefined && item.created_by !== undefined && (
    String(currentUserId) === String(item.created_by)
  );

  // If the current user is the author, they did not receive it; they created/sent it
  if (isAuthor) {
    return null;
  }

  const isTemplate = item.itemType === 'template';
  const raw = isTemplate ? (item.template_approvers || item.approvers) : (item.approvers || item.template_approvers);
  let matchedReviewer = null;

  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
      const approvers = Array.isArray(parsed.approvers) ? parsed.approvers : (Array.isArray(parsed) ? parsed : []);
      const allWorkflow = [...reviewers, ...approvers];

      const userEmail = currentUser.email ? String(currentUser.email).toLowerCase().trim() : '';

      matchedReviewer = allWorkflow.find((p) => {
        const pId = p.userId ?? p.id;
        const byId = pId !== undefined && currentUserId !== undefined && String(pId) === String(currentUserId);
        const byEmail = userEmail && p.email && String(p.email).toLowerCase().trim() === userEmail;
        return byId || byEmail;
      });
    } catch (_) {}
  }

  // 1. If reviewer has a specific received_at or assigned_at timestamp
  if (matchedReviewer) {
    const specificDate = matchedReviewer.received_at ||
      matchedReviewer.receivedAt ||
      matchedReviewer.assigned_at ||
      matchedReviewer.assignedAt;
    if (specificDate) return specificDate;
  }

  // 2. If item row has received_at or assigned_at
  if (item.received_at) {
    return item.received_at;
  }
  if (item.assigned_at) {
    return item.assigned_at;
  }

  // 3. Fallback: if the reviewer was matched, return updated_at (when sent/updated for review) or created_at
  if (matchedReviewer) {
    return item.updated_at || item.created_at;
  }

  // 4. Admin or Project Manager viewing an item they did not author
  if (currentUser.role === 'admin' || currentUser.role === 'project_manager') {
    return item.updated_at || item.created_at;
  }

  return null;
};

export const formatId = (id, type) => {
  const prefix = type === 'template' ? 'TEMP' : 'DOC';
  if (typeof id === 'number') return `${prefix}-${String(id).padStart(3, '0')}`;
  const cleanStr = String(id || '');
  return `${prefix}-${cleanStr.substring(0, 8).toUpperCase()}`;
};

export const getStatusTagColor = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'draft') {
    return 'bg-slate-100 text-slate-700 border-slate-300 font-bold';
  }
  if (s === 'archive_draft') {
    return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
  }
  if (s === 'pending_archive_review') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (s === 'archive_reviewed') {
    return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
  }
  if (s === 'pending' || s === 'pending_review') {
    return 'bg-orange-50 text-orange-700 border-orange-200';
  }
  if (s === 'reviewed') {
    return 'bg-teal-50 text-teal-700 border-teal-200';
  }
  if (s === 'pending_approval' || s === 'approved') {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }
  if (s === 'pending_archive_approval') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (s === 'pending_revision') {
    return 'bg-amber-50 text-amber-700 border-amber-300 font-medium';
  }
  if (s === 'published' || s === 'active') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s === 'rejected') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (s === 'archived' || s === 'old') {
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

export const getInlineDueDateInfo = (dueDateStr, isTemplate, item) => {
  const rawDate = isTemplate ? item.due_date : getMockedDueDate(item);
  const dateObj = rawDate ? new Date(rawDate) : new Date();
  const diffTime = dateObj - new Date();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  let label = `Due in ${diffDays}d`;

  if (diffDays < 0) {
    colorClass = 'text-red-700 bg-red-50 border-red-200';
    label = `Overdue (${Math.abs(diffDays)}d)`;
  } else if (diffDays <= 3) {
    colorClass = 'text-orange-700 bg-orange-50 border-orange-200';
    label = `Due in ${diffDays}d`;
  }

  return { colorClass, label, dateStr: dateObj.toLocaleDateString() };
};

export const getContentPreviewText = (item) => {
  if (!item.content) return 'No preview available.';
  try {
    const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
    const htmlText = parsed.content || '';
    const cleanText = htmlText.replace(/<\/?[^>]+(>|$)/g, "");
    return cleanText.length > 80 ? cleanText.substring(0, 80) + '...' : cleanText || 'No preview available.';
  } catch {
    const htmlText = String(item.content);
    const cleanText = htmlText.replace(/<\/?[^>]+(>|$)/g, "");
    return cleanText.length > 80 ? cleanText.substring(0, 80) + '...' : cleanText;
  }
};

/**
 * Computes mocked/real values for templates and documents and filters them based on active dashboard selections.
 */
export const computeItemDetailsAndFilter = (item, type, options) => {
  const {
    progressOverrides = {},
    pinnedIds = [],
    activeTab,
    appliedSearch,
    appliedDept,
    appliedStartDate,
    appliedEndDate,
    appliedOwner,
    appliedApproverGroup,
    currentUser,
    viewAllReadOnly,
    ignoreTabStatus,
    users = [],
    reassignedIds = new Set()
  } = options;

  const rawItemId = String(item.id || item.document_id || '');
  if (reassignedIds && (reassignedIds.has?.(rawItemId) || (Array.isArray(reassignedIds) && reassignedIds.includes(rawItemId)))) {
    return null;
  }

  let progress = 0;
  if (progressOverrides[item.id] !== undefined) {
    progress = Number(progressOverrides[item.id]) || 0;
  } else {
    const raw = item.progress_value !== undefined && item.progress_value !== null && item.progress_value !== ''
      ? item.progress_value
      : item.completion_rate;
    if (raw !== undefined && raw !== null && raw !== '') {
      progress = Number(raw) || 0;
    } else {
      progress = 0;
    }
  }

  // Resolve real owner name from item, users collection, or current user
  let creatorName = item.created_by_name;
  if (!creatorName && users && users.length && item.created_by) {
    const matchedUser = users.find(u => String(u.id || u.userId) === String(item.created_by));
    if (matchedUser) {
      const fullName = `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim();
      creatorName = fullName || matchedUser.email || matchedUser.username;
    }
  }
  if (!creatorName && currentUser && String(currentUser.id || currentUser.userId) === String(item.created_by)) {
    creatorName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email;
  }
  if (!creatorName) {
    creatorName = 'Sarah Jenkins';
  }

  const mappedItem = {
    ...item,
    id: item.id || item.document_id,
    itemType: type,
    name: item.name || item.title || '',
    title: item.title || item.name || '',
    created_by_name: creatorName,
    is_pinned: (item.is_pinned === 1 || item.is_pinned === true) ? 1 : 0,
    progress_value: progress
  };

  if (!ignoreTabStatus) {
    const s = (item.status || '').toLowerCase();
    if (activeTab === 'Draft' && s !== 'draft' && s !== 'archive_draft') return null;
    if (activeTab === 'In Progress' && !['draft', 'archive_draft', 'pending', 'pending_review', 'reviewed', 'pending_approval', 'approved', 'rejected', 'pending_archive_review', 'archive_reviewed', 'pending_archive_approval'].includes(s)) return null;
    if (activeTab === 'Published' && s !== 'published' && s !== 'active' && s !== 'pending_revision') return null;
    if (activeTab === 'Archived' && s !== 'archived' && s !== 'old' && s !== 'pending_archive_approval' && s !== 'pending_archive_review' && s !== 'archive_reviewed' && s !== 'revised') return null;
  }

  if (appliedSearch && typeof appliedSearch === 'string') {
    const rawSearch = appliedSearch.trim();
    if (rawSearch) {
      const searchLower = rawSearch.toLowerCase();
      const tokens = searchLower.split(/\s+/).filter(Boolean);

      const nameText = (item.name || item.title || '').toLowerCase();
      const descText = (item.description || '').toLowerCase();
      const ownerText = (creatorName || item.created_by_name || '').toLowerCase();
      const docNumText = (item.document_number || item.documentNumber || item.project_number || item.cost_center_number || '').toLowerCase();
      const categoryText = (getDisplayCategory(item) || item.department || item.category_name || '').toLowerCase();
      const statusText = (item.status || '').toLowerCase();
      const idText = String(item.id || item.document_id || '').toLowerCase();

      let contentText = '';
      if (item.content) {
        if (typeof item.content === 'object') {
          contentText = (item.content.html || item.content.content || JSON.stringify(item.content)).toLowerCase();
        } else if (typeof item.content === 'string') {
          const rawContent = item.content.trim();
          if (rawContent.startsWith('{')) {
            try {
              const parsed = JSON.parse(rawContent);
              contentText = (parsed.html || parsed.content || rawContent).toLowerCase();
            } catch (_) {
              contentText = rawContent.toLowerCase();
            }
          } else {
            contentText = rawContent.toLowerCase();
          }
        }
      }
      
      // Strip HTML tags so tag names aren't falsely matched
      const cleanContentText = contentText.replace(/<[^>]*>/g, ' ');

      const combinedSearchable = `${nameText} ${descText} ${ownerText} ${docNumText} ${categoryText} ${statusText} ${idText} ${cleanContentText}`;

      // Search matches if full phrase matches anywhere OR all individual tokens match
      const matchesFull = combinedSearchable.includes(searchLower);
      const matchesTokens = tokens.length > 1 && tokens.every(tok => combinedSearchable.includes(tok));

      if (!matchesFull && !matchesTokens) {
        return null;
      }
    }
  }

  if (appliedDept && getDisplayCategory(item) !== appliedDept) return null;
  if (appliedStartDate && new Date(item.updated_at || item.created_at) < new Date(appliedStartDate)) return null;
  if (appliedEndDate) {
    const border = new Date(appliedEndDate);
    border.setDate(border.getDate() + 1);
    if (new Date(item.updated_at || item.created_at) >= border) return null;
  }
  if (appliedOwner && (creatorName || item.created_by_name || 'Sarah Jenkins') !== appliedOwner) return null;

  if (activeTab === 'In Progress' && appliedApproverGroup) {
    const grp = String(appliedApproverGroup).toLowerCase();
    const status = String(item.status || '').toLowerCase();
    if (grp === 'review') {
      if (status !== 'pending_review' && status !== 'pending' && status !== 'reviewed' && status !== 'pending_archive_review' && status !== 'archive_reviewed') return null;
    } else if (grp === 'approver') {
      if (status !== 'pending_approval' && status !== 'approved' && status !== 'pending_archive_approval') return null;
    }
  }

  if (currentUser) {
    const currentUserId = currentUser.id ?? currentUser.userId;
    const currentUserEmail = (currentUser.email || '').trim().toLowerCase();
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'project_manager';
    const isViewer = currentUser.role === 'viewer';
    const isDraft = activeTab === 'Draft';
    const isInProgress = activeTab === 'In Progress';

    if (!isAdmin && !isViewer && !viewAllReadOnly) {
      const isAuthor = (currentUserId !== undefined && item.created_by !== undefined && String(item.created_by) === String(currentUserId)) ||
        (currentUserEmail && item.created_by_email && String(item.created_by_email).trim().toLowerCase() === currentUserEmail);

      if (isDraft) {
        if (!isAuthor) return null;
      } else if (isInProgress) {
        const itemStatus = (item.status || '').toLowerCase();
        const isItemDraft = itemStatus === 'draft' || itemStatus === 'archive_draft';

        if (isItemDraft) {
          if (!isAuthor) return null;
        } else {
          const raw = item.approvers || item.template_approvers;
          let isUserInWorkflow = false;
          if (raw) {
            try {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
              const approvers = Array.isArray(parsed.approvers) ? parsed.approvers : (Array.isArray(parsed) ? parsed : []);
              const people = [...reviewers, ...approvers];
              isUserInWorkflow = people.some((p) => {
                const pId = p.userId ?? p.id;
                const byId = pId !== undefined && currentUserId !== undefined && String(pId) === String(currentUserId);
                const byEmail = currentUserEmail && p.email && String(p.email).trim().toLowerCase() === currentUserEmail;
                return byId || byEmail;
              });
            } catch (e) {
              isUserInWorkflow = false;
            }
          }
          if (!isUserInWorkflow && !isAuthor) return null;
        }
      }
    }
  }

  return mappedItem;
};
