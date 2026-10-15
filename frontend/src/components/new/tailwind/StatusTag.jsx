import React from 'react';
import PropTypes from 'prop-types';

export default function StatusTag({ status }) {
  const normalized = (status || '').toLowerCase();
  
  const statusStyles = {
    draft: 'bg-brand-slate-100 text-brand-slate-500 border-brand-slate-200',
    pending: 'bg-brand-orange-50 text-brand-orange-500 border-brand-orange-100',
    published: 'bg-brand-green-50 text-brand-green-500 border-brand-green-100',
    archived: 'bg-brand-red-50 text-brand-red-500 border-brand-red-100',
    old: 'bg-brand-red-50 text-brand-red-500 border-brand-red-100',
    active: 'bg-brand-green-50 text-brand-green-500 border-brand-green-100',
    revision: 'bg-brand-orange-50 text-brand-orange-500 border-brand-orange-100',
    pending_revision: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const labelMap = {
    draft: 'Draft',
    pending: 'Pending',
    published: 'Published',
    archived: 'Archived',
    old: 'Archived',
    active: 'Active',
    revision: 'Revision',
    pending_revision: 'In Revision',
  };

  const styleClass = statusStyles[normalized] || 'bg-brand-slate-100 text-brand-slate-500 border-brand-slate-200';
  const label = labelMap[normalized] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styleClass}`}>
      {label}
    </span>
  );
}

StatusTag.propTypes = {
  status: PropTypes.string.isRequired,
};
