import React from 'react';
import PropTypes from 'prop-types';

export default function CompletionRate({ rate }) {
  const percentage = Math.min(Math.max(rate || 0, 0), 100);

  return (
    <div className="w-full select-none">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold text-brand-slate-500 uppercase tracking-wide">Completion</span>
        <span className="text-xs font-bold text-brand-blue-500">{percentage}%</span>
      </div>
      <div className="w-full bg-brand-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-brand-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

CompletionRate.propTypes = {
  rate: PropTypes.number.isRequired,
};
