/**
 * @file UnifiedPreviewModal.jsx
 * @description Stage-aware document/template preview modal.
 *   Detects lifecycle stage from item.status and renders the correct
 *   tab set, banner, metadata sidebar, and action button for each stage.
 *
 * Stages:
 *   draft       → Overview, Content, Tasks (doc), Participants (doc)
 *   in_progress → Overview, Workflow, Content, Participants (doc)
 *   published   → Overview, Content, Workflow, References, Structure (tpl)
 *   archived    → Overview, Content, Workflow
 *
 * @dependencies react, prop-types, sub-components in ./UnifiedPreviewModal/
 * @author Codegen
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import PreviewLeftPane from './UnifiedPreviewModal/PreviewLeftPane';
import PreviewStatusBanner from './UnifiedPreviewModal/PreviewStatusBanner';
import OverviewTab from './UnifiedPreviewModal/tabs/OverviewTab';
import ContentTab from './UnifiedPreviewModal/tabs/ContentTab';
import TasksTab from './UnifiedPreviewModal/tabs/TasksTab';
import ParticipantsTab from './UnifiedPreviewModal/tabs/ParticipantsTab';
import WorkflowTab from './UnifiedPreviewModal/tabs/WorkflowTab';
import ReferencesTab from './UnifiedPreviewModal/tabs/ReferencesTab';
import StructureTab from './UnifiedPreviewModal/tabs/StructureTab';
import NotesTab from './UnifiedPreviewModal/tabs/NotesTab';
import { getDisplayCategory } from '../../../pages/new/Hub/utils/dashboardUtils';
import { useAuth } from '../../../utils/authService';
import { getDocument } from '../../../api/documents';
import { getTemplate } from '../../../api/templates';

// ─── Stage detection ────────────────────────────────────────────────────────

function detectStage(status) {
  const s = (status || '').toLowerCase();
  if (s === 'draft' || s === 'archive_draft') return 'draft';
  if (['pending', 'pending_review', 'pending_approval', 'reviewed', 'approved', 'pending_archive_review', 'archive_reviewed', 'pending_archive_approval'].includes(s)) return 'in_progress';
  if (['published', 'active'].includes(s)) return 'published';
  if (['archived', 'old', 'revised'].includes(s)) return 'archived';
  return 'draft';
}

// ─── Tab definitions per stage ───────────────────────────────────────────────

function buildTabs(stage, isDocument, isTemplate) {
  const workflowLabel = (stage === 'published' || stage === 'archived') ? 'Approvers' : 'Workflow';
  const workflowIcon = (stage === 'published' || stage === 'archived') ? 'verified' : 'account_tree';

  switch (stage) {
    case 'draft':
      if (isTemplate) {
        return [
          { id: 'overview', label: 'Overview', icon: 'info' },
          { id: 'content', label: 'Content', icon: 'article' },
          { id: 'participants', label: 'Participants', icon: 'group' },
          { id: 'structure', label: 'Structure', icon: 'lock' },
          { id: 'notes', label: 'Notes', icon: 'rate_review' },
        ];
      } else {
        return [
          { id: 'overview', label: 'Overview', icon: 'info' },
          { id: 'content', label: 'Content', icon: 'article' },
          { id: 'tasks', label: 'Tasks', icon: 'task_alt' },
          { id: 'participants', label: 'Participants', icon: 'group' },
        ];
      }
    case 'in_progress':
      if (isTemplate) {
        return [
          { id: 'overview', label: 'Overview', icon: 'info' },
          { id: 'workflow', label: workflowLabel, icon: workflowIcon },
          { id: 'content', label: 'Content', icon: 'article' },
          { id: 'tasks', label: 'Tasks', icon: 'task_alt' },
          { id: 'structure', label: 'Structure', icon: 'lock' },
          { id: 'notes', label: 'Notes', icon: 'rate_review' },
        ];
      } else {
        return [
          { id: 'overview', label: 'Overview', icon: 'info' },
          { id: 'workflow', label: workflowLabel, icon: workflowIcon },
          { id: 'content', label: 'Content', icon: 'article' },
          { id: 'structure', label: 'Structure', icon: 'lock' },
          { id: 'notes', label: 'Notes', icon: 'rate_review' },
        ];
      }
    case 'published':
    case 'archived':
      return [
        { id: 'overview', label: 'Overview', icon: 'info' },
        { id: 'content', label: 'Content', icon: 'article' },
        { id: 'workflow', label: workflowLabel, icon: workflowIcon },
        { id: 'references', label: 'References', icon: 'menu_book' },
        { id: 'notes', label: 'Notes', icon: 'rate_review' },
      ];
    default:
      return [
        { id: 'overview', label: 'Overview', icon: 'info' },
        { id: 'content', label: 'Content', icon: 'article' },
      ];
  }
}

// ─── Tab content router ──────────────────────────────────────────────────────

function TabContent({ tabId, item, isDocument, stage, user }) {
  const shared = { item, isDocument, user };
  switch (tabId) {
    case 'overview': return <OverviewTab     {...shared} getDisplayCategory={getDisplayCategory} />;
    case 'content': return <ContentTab item={item} dimmed={stage === 'archived'} />;
    case 'tasks': return <TasksTab item={item} />;
    case 'participants': return <ParticipantsTab item={item} isDocument={isDocument} />;
    case 'workflow': return <WorkflowTab item={item} onlyApprovers={stage === 'published' || stage === 'archived'} />;
    case 'references': return <ReferencesTab item={item} />;
    case 'structure': return <StructureTab item={item} />;
    case 'notes': return <NotesTab item={item} isDocument={isDocument} />;
    default: return null;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UnifiedPreviewModal({ visible, item, onClose, onEdit, onAction, onProgressChange }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useAuth();

  const stage = item ? detectStage(item.status) : 'draft';
  const [detailedItem, setDetailedItem] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const effectiveItem = detailedItem || item;
  const isDocument = effectiveItem ? effectiveItem.itemType !== 'template' : true;
  const isTemplate = !isDocument;
  const tabs = effectiveItem ? buildTabs(stage, isDocument, isTemplate) : [];

  // Check if current user is an active reviewer/approver
  const isReviewerOrApprover = (() => {
    if (!effectiveItem || !user?.id) return false;

    const status = String(effectiveItem.status || '').toLowerCase();
    // Admins can always review/approve for standard workflows, but NOT for archive requests unless explicitly assigned
    if (user.role === 'admin' && status !== 'pending_archive_approval' && status !== 'pending_archive_review') return true;

    const raw = effectiveItem.itemType !== 'template' ? effectiveItem.approvers : effectiveItem.template_approvers;
    if (!raw) return false;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reviewers = Array.isArray(parsed?.reviewers) ? parsed.reviewers : [];
      const approvers = Array.isArray(parsed?.approvers) ? parsed.approvers : (Array.isArray(parsed) ? parsed : []);

      const matchesUser = (entry) => {
        if (!entry) return false;
        const idMatch = (entry.userId && Number(entry.userId) === Number(user.id)) ||
                        (entry.id && Number(entry.id) === Number(user.id));
        const emailMatch = entry.email && user.email && entry.email.trim().toLowerCase() === user.email.trim().toLowerCase();
        return Boolean(idMatch || emailMatch);
      };

      if (status === 'pending_review' || status === 'pending_archive_review') {
        return reviewers.some(matchesUser);
      } else if (status === 'pending_approval' || status === 'pending_archive_approval') {
        return approvers.some(matchesUser);
      }
    } catch (_) { }
    return false;
  })();

  // Reset active tab and fetch full details when item changes or modal opens
  useEffect(() => {
    if (visible && item) {
      setActiveTab('overview');
      setDetailedItem(item);
      setLoadingDetails(true);
      const loadDetails = async () => {
        try {
          const fetched = item.itemType !== 'template'
            ? await getDocument(item.id)
            : await getTemplate(item.id);
          setDetailedItem(fetched);
        } catch (e) {
          console.warn('Failed to load item preview details:', e);
        } finally {
          setLoadingDetails(false);
        }
      };
      loadDetails();
    } else {
      setDetailedItem(null);
    }
  }, [visible, item?.id]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  if (!visible || !item) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[10050] flex items-center justify-center p-4 md:p-6 animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Modal card */}
      <div className="relative bg-surface border border-outline-variant rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col md:flex-row overflow-hidden shadow-2xl z-10 animate-scale-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high p-1.5 rounded-full transition-colors z-20 flex items-center justify-center"
          title="Close"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* ── Left Sidebar ── */}
        <PreviewLeftPane
          item={detailedItem || item}
          stage={stage}
          onEdit={onEdit}
          onAction={onAction || (() => { })}
          onProgressChange={onProgressChange}
          isReviewerOrApprover={isReviewerOrApprover}
        />

        {/* ── Right Pane ── */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-container-lowest">
          {/* Stage banner */}
          <div className="px-5 pt-5 pb-0 shrink-0">
            <PreviewStatusBanner
              stage={stage}
              isReviewerOrApprover={isReviewerOrApprover}
              onAction={(action) => onAction(action, item.id, item.itemType)}
            />
          </div>

          {/* Tab bar */}
          <div className="px-5 pt-3 border-b border-outline-variant shrink-0">
            <div className="flex gap-5 overflow-x-auto scrollbar-none">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 pb-2.5 transition-all relative whitespace-nowrap text-xs font-semibold border-b-2 ${activeTab === tab.id
                    ? 'text-blue-700 border-blue-700'
                    : 'text-on-surface-variant hover:text-on-surface border-transparent'
                    }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            <TabContent
              tabId={activeTab}
              item={detailedItem || item}
              isDocument={isDocument}
              stage={stage}
              user={user}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

UnifiedPreviewModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  item: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onAction: PropTypes.func,
  onProgressChange: PropTypes.func,
};
