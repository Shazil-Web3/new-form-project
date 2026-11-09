/**
 * @file ParticipantsTab.jsx
 * @description Read-only participant groups (Authors, Reviewers, Approvers) for document previews.
 *   Mirrors the ParticipantsStep wizard fields: name, email, role.
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

const ROLE_CONFIG = {
  author: {
    label: 'Authors',
    sublabel: 'Full Write Access',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'edit',
  },
  document_reviewer: {
    label: 'Reviewers',
    sublabel: 'Comment & Feedback',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: 'rate_review',
  },
  document_approver: {
    label: 'Approvers',
    sublabel: 'Sign-off & Release',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: 'verified',
  },
};

function Chip({ person }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-highest border border-outline-variant/40 rounded-full shadow-inner text-xs font-semibold text-on-surface">
      <div className="w-5 h-5 rounded-full bg-blue-700 text-white text-[9px] font-extrabold flex items-center justify-center uppercase shrink-0">
        {String(person.name || person.email || '?').substring(0, 2)}
      </div>
      <span className="truncate max-w-[120px]">{person.name || person.email}</span>
    </div>
  );
}

function RoleGroup({ roleKey, participants }) {
  const cfg = ROLE_CONFIG[roleKey] || { label: roleKey, sublabel: '', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'person' };
  const people = participants.filter(p => p.role === roleKey);

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">{cfg.icon}</span>
        <span className="text-xs font-bold text-on-surface">{cfg.label}</span>
        <span className="text-xs text-on-surface-variant/50">({cfg.sublabel})</span>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
          {people.length}
        </span>
      </div>
      {people.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {people.map((p, i) => <Chip key={i} person={p} />)}
        </div>
      ) : (
        <span className="text-xs text-on-surface-variant/40 italic">None assigned.</span>
      )}
    </div>
  );
}

export default function ParticipantsTab({ item, isDocument }) {
  let participants = [];
  if (item && (item.itemType === 'template' || !isDocument)) {
    const ta = item.template_approvers || {};
    const authors = Array.isArray(ta.authors) ? ta.authors.map(p => ({ ...p, role: 'author' })) : [];
    const reviewers = Array.isArray(ta.reviewers) ? ta.reviewers.map(p => ({ ...p, role: 'document_reviewer' })) : [];
    const approvers = Array.isArray(ta.approvers) ? ta.approvers.map(p => ({ ...p, role: 'document_approver' })) : [];
    participants = [...authors, ...reviewers, ...approvers];
  } else if (item) {
    participants = Array.isArray(item.participants) ? item.participants : [];
  }

  return (
    <div className="animate-fade-in space-y-3">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider mb-3">
        Participants
      </p>
      {['author', 'document_reviewer', 'document_approver'].map(role => (
        <RoleGroup key={role} roleKey={role} participants={participants} />
      ))}
    </div>
  );
}

ParticipantsTab.propTypes = {
  item: PropTypes.object.isRequired,
  isDocument: PropTypes.bool,
};
