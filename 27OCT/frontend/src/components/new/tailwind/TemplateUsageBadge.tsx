import React from 'react';
import PropTypes from 'prop-types';

export default function TemplateUsageBadge({ usageCount }) {
  return (
    <span className="inline-flex items-center text-xs font-semibold text-brand-slate-500 gap-1 select-none">
      {/* File/Doc Icon */}
      <svg className="w-4 h-4 text-brand-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Used {usageCount || 0} times
    </span>
  );
}

TemplateUsageBadge.propTypes = {
  usageCount: PropTypes.number.isRequired,
};
