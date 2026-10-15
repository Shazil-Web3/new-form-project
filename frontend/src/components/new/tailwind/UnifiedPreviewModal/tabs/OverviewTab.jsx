/**
 * @file OverviewTab.jsx
 * @description Read-only metadata key-value table shown in all stage previews.
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { getReceivedAt } from '../../../../../pages/new/Hub/utils/dashboardUtils';

function InfoRow({ label, value, pill }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-outline-variant/30 last:border-0">
      <span className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wide shrink-0 pt-0.5">
        {label}
      </span>
      {pill ? (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${pill}`}>
          {value || '—'}
        </span>
      ) : (
        <span className="text-sm font-medium text-on-surface text-right max-w-[60%] break-words">
          {value || '—'}
        </span>
      )}
    </div>
  );
}

function fmt(dateStr) {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

export default function OverviewTab({ item, isDocument, getDisplayCategory, user }) {
  const category = getDisplayCategory ? getDisplayCategory(item) : (item.category || '—');
  const receivedDate = getReceivedAt(item, user);

  return (
    <div className="space-y-0 animate-fade-in">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider mb-3">
        {isDocument ? 'Document' : 'Template'} Metadata
      </p>

      <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 divide-y divide-outline-variant/20">
        <InfoRow label="Title" value={item.name || item.title} />
        {item.description && (
          <InfoRow label="Description" value={item.description} />
        )}
        {isDocument && item.document_number && (
          <InfoRow label="Document Number" value={item.document_number} />
        )}
        {isDocument && item.project_number && (
          <InfoRow label="Project Number" value={item.project_number} />
        )}
        {isDocument && item.cost_center_number && (
          <InfoRow label="Cost Center" value={item.cost_center_number} />
        )}
        <InfoRow label="Category" value={category} />
        {item.department && <InfoRow label="Department" value={item.department} />}
        <InfoRow label="Version" value={`v${item.version || '1.0'}`} />
        {isDocument && item.due_date && (
          <InfoRow label="Due Date" value={fmt(item.due_date)} />
        )}
        <InfoRow label="Created" value={fmt(item.created_at)} />
        {receivedDate && (
          <InfoRow label="Received At" value={fmt(receivedDate)} />
        )}
        <InfoRow label="Owner" value={item.owner_name || item.created_by_name || 'Sarah Jenkins'} />
      </div>
    </div>
  );
}

OverviewTab.propTypes = {
  item: PropTypes.object.isRequired,
  isDocument: PropTypes.bool,
  getDisplayCategory: PropTypes.func,
};
