/**
 * @file ApproverAvatars.jsx
 * @description Standard circular avatars for reviewers and approvers with 1px status rings and positive spacing gaps
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

export default function ApproverAvatars({ approvers, onReassign, canReassign }) {
  if (!approvers || approvers.length === 0) {
    return <span className="text-on-surface-variant/60 text-xs italic">None assigned</span>;
  }

  // Ring styling by status (1px ring outline)
  const getRingClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'reviewed' || s === 'yes') {
      return 'ring-1 ring-emerald-500 ring-offset-1 bg-emerald-50 text-emerald-800';
    }
    if (s === 'rejected' || s === 'no') {
      return 'ring-1 ring-red-500 ring-offset-1 bg-red-50 text-red-800';
    }
    return 'ring-1 ring-amber-500 ring-offset-1 bg-amber-50 text-amber-800';
  };

  const getStatusIcon = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'reviewed' || s === 'yes') return 'check';
    if (s === 'rejected' || s === 'no') return 'close';
    return 'schedule';
  };

  // Group reviewers and approvers
  const reviewers = approvers.filter(a => String(a.role || '').toUpperCase().includes('REVIEW'));
  const finalApprovers = approvers.filter(a => !String(a.role || '').toUpperCase().includes('REVIEW'));

  const renderGroup = (list) => {
    return (
      <div className="flex items-center gap-1.5 overflow-visible">
        {list.map((app, idx) => {
          const initials = (app.name || 'U').substring(0, 2).toUpperCase();
          const statusVal = app.status || 'pending';

          return (
            <div key={idx} className="group relative overflow-visible z-10 hover:z-30">
              {/* Perfectly rounded avatar circle with thin ring and positive spacing gap */}
              <div className={`w-7 h-7 rounded-full border border-outline flex items-center justify-center text-[9px] font-extrabold select-none cursor-pointer transition-all hover:scale-105 flex-shrink-0 ${getRingClass(statusVal)}`}>
                {app.avatar ? (
                  <img src={app.avatar} alt={app.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span>{initials}</span>
                )}

                {/* Mini status indicator */}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center border border-white text-[7px] text-white font-extrabold ${
                  statusVal.toLowerCase() === 'approved' || statusVal.toLowerCase() === 'reviewed'
                    ? 'bg-emerald-500'
                    : statusVal.toLowerCase() === 'rejected'
                      ? 'bg-red-500'
                      : 'bg-amber-500'
                }`}>
                  <span className="material-symbols-outlined text-[7px] font-bold">
                    {getStatusIcon(statusVal)}
                  </span>
                </span>
              </div>

              {/* Tooltip Overlay */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col w-52 p-3 bg-surface-container-high border border-outline rounded-lg shadow-xl text-left pointer-events-auto select-none z-50 transition-all duration-200 before:content-[''] before:absolute before:top-full before:left-0 before:w-full before:h-3">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-outline-variant">
                  <span className="font-semibold text-xs text-on-surface truncate pr-2">
                    {app.name}
                  </span>
                  <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${
                    statusVal.toLowerCase() === 'approved' || statusVal.toLowerCase() === 'reviewed'
                      ? 'bg-success/15 text-success'
                      : statusVal.toLowerCase() === 'rejected'
                        ? 'bg-error/15 text-error'
                        : 'bg-warning/15 text-warning'
                  }`}>
                    {statusVal}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-[9px] text-on-surface-variant font-medium">
                  {Boolean(onReassign) && (canReassign ? canReassign(app) : true) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onReassign(app);
                      }}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-[11px] font-bold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-md shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none"
                    >
                      <span className="material-symbols-outlined text-[13px] font-bold">person_add</span>
                      Assign
                    </button>
                  ) : (
                    <div><span className="text-on-surface-variant/70 font-semibold">Role:</span> {app.role || 'Reviewer'}</div>
                  )}
                  {app.updatedAt && (
                    <div><span className="text-on-surface-variant/70 font-semibold">Time:</span> {new Date(app.updatedAt).toLocaleDateString()}</div>
                  )}
                  {app.comment && (
                    <div className="mt-1.5 p-1 bg-surface rounded border border-outline-variant/50 max-h-16 overflow-y-auto italic">
                      "{app.comment}"
                    </div>
                  )}
                </div>
                <div className="w-2 h-2 bg-surface-container-high border-r border-b border-outline rotate-45 absolute top-full left-1/2 -translate-x-1/2 -mt-1 pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 select-none overflow-visible py-0.5">
      {reviewers.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-on-surface-variant/45 w-8 text-right uppercase">Rev:</span>
          {renderGroup(reviewers)}
        </div>
      )}
      {finalApprovers.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-on-surface-variant/45 w-8 text-right uppercase">App:</span>
          {renderGroup(finalApprovers)}
        </div>
      )}
    </div>
  );
}

ApproverAvatars.propTypes = {
  approvers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string.isRequired,
      avatar: PropTypes.string,
      role: PropTypes.string,
      status: PropTypes.string,
      comment: PropTypes.string,
      updatedAt: PropTypes.string,
    })
  ),
  onReassign: PropTypes.func,
  canReassign: PropTypes.func,
};

ApproverAvatars.defaultProps = {
  approvers: [],
};
