/**
 * @file WorkflowTab.jsx
 * @description Displays the workflow approval chain: reviewers + approvers with their status.
 *   Parses item.template_approvers (templates) or item.approvers (documents).
 *   Uses getApproversForTemplate / getApproversForDoc format: [{ name, email, role, status }]
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

function parseWorkflow(item) {
  const isTemplate = item.itemType === 'template';
  const raw = isTemplate ? item.template_approvers : item.approvers;
  if (!raw) return { reviewers: [], approvers: [] };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
      approvers: Array.isArray(parsed.approvers) ? parsed.approvers : [],
    };
  } catch (_) {
    return { reviewers: [], approvers: [] };
  }
}

const STATUS_STYLES = {
  reviewed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:   'bg-orange-50 text-orange-700 border-orange-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
};

function formatActionDateTime(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const dateFormatted = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    return { date: dateFormatted, time: timeFormatted };
  } catch {
    return null;
  }
}

function PersonRow({ person, roleBadge, item }) {
  const statusKey = (person.status || 'pending').toLowerCase();
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.pending;
  const initials = String(person.name || person.email || '?').substring(0, 2).toUpperCase();

  const actionDate = person.reviewedAt || person.reviewed_at || person.approvedAt || person.approved_at || person.rejectedAt || person.rejected_at || person.actionDate || person.date || person.timestamp;
  const dt = formatActionDateTime(actionDate);

  const receivedDate = person.received_at || person.receivedAt || person.assigned_at || person.assignedAt || item?.received_at || (item?.status !== 'draft' ? (item?.updated_at || item?.created_at) : null);
  const recDt = formatActionDateTime(receivedDate);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/20 last:border-0">
      <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-inner">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{person.name || 'Unknown'}</p>
        {person.email && (
          <p className="text-xs text-on-surface-variant/60 truncate">{person.email}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant/70 mt-1">
          {recDt && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-blue-600">inbox</span>
              <span>Received: <strong className="text-on-surface">{recDt.date}</strong> <span className="font-mono text-on-surface-variant/80 text-[10px]">• Time: {recDt.time}</span></span>
            </div>
          )}
          {person.dueDate && (
            (() => {
              const dueDt = formatActionDateTime(person.dueDate);
              const rawDue = typeof person.dueDate === 'string' ? person.dueDate : '';
              const hasExplicitTime = (rawDue.includes('T') && !rawDue.endsWith('T00:00:00.000Z') && !rawDue.endsWith('T00:00:00')) || (rawDue.includes(':') && !rawDue.endsWith('00:00:00'));
              const displayTime = hasExplicitTime && dueDt ? dueDt.time : (dueDt?.time || '11:59:59 PM');
              return (
                <div className="flex items-center gap-1.5">
                  {recDt && <span className="text-outline-variant/60">•</span>}
                  <span className="material-symbols-outlined text-[13px] text-on-surface-variant/70">event</span>
                  <span>Due: <strong className="text-on-surface">{dueDt ? dueDt.date : new Date(person.dueDate).toLocaleDateString()}</strong></span>
                  <span className="text-outline-variant/60">•</span>
                  <span className="material-symbols-outlined text-[13px] text-blue-600">schedule</span>
                  <span>Time: <strong className="font-mono text-on-surface">{displayTime}</strong></span>
                </div>
              );
            })()
          )}
          {dt && (
            <div className="flex items-center gap-1">
              {(recDt || person.dueDate) && <span className="text-outline-variant/60">•</span>}
              <span className={`material-symbols-outlined text-[13px] ${statusKey === 'rejected' ? 'text-red-600' : 'text-emerald-600'}`}>
                {statusKey === 'rejected' ? 'cancel' : 'check_circle'}
              </span>
              <span>
                {person.status || 'Action'}: <strong className="text-on-surface">{dt.date}</strong>
                {statusKey !== 'rejected' && (
                  <> at <span className="font-mono text-on-surface-variant/90">{dt.time}</span></>
                )}
              </span>
            </div>
          )}
        </div>
        {person.comment && (
          <p className="text-xs text-on-surface-variant/80 italic mt-0.5">"{person.comment}"</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wide">{roleBadge}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${statusStyle}`}>
          {person.status || 'Pending'}
        </span>
      </div>
    </div>
  );
}

function WorkflowSection({ title, icon, people, roleBadge, emptyMsg, item }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">{icon}</span>
        <span className="text-xs font-bold text-on-surface uppercase tracking-wide">{title}</span>
        <span className="ml-auto text-xs font-semibold text-on-surface-variant/60">{people.length} member{people.length !== 1 ? 's' : ''}</span>
      </div>
      {people.length > 0 ? (
        people.map((p, i) => <PersonRow key={i} person={p} roleBadge={roleBadge} item={item} />)
      ) : (
        <p className="text-xs text-on-surface-variant/40 italic py-2">{emptyMsg}</p>
      )}
    </div>
  );
}

export default function WorkflowTab({ item, onlyApprovers = false }) {
  const { reviewers, approvers } = parseWorkflow(item);

  return (
    <div className="animate-fade-in space-y-4">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider">
        Workflow Chain
      </p>
      {!onlyApprovers && (
        <WorkflowSection
          title="Reviewers"
          icon="rate_review"
          people={reviewers}
          roleBadge="Review"
          emptyMsg="No reviewers assigned."
          item={item}
        />
      )}
      <WorkflowSection
        title="Approvers"
        icon="verified"
        people={approvers}
        roleBadge="Approval"
        emptyMsg="No approvers assigned."
        item={item}
      />
    </div>
  );
}

WorkflowTab.propTypes = {
  item: PropTypes.object.isRequired,
  onlyApprovers: PropTypes.bool,
};
