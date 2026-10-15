import React from 'react';
import PropTypes from 'prop-types';

export default function WorkflowProgressGrid({ approvers }) {
  if (!approvers || approvers.length === 0) {
    return <span className="text-xs text-on-surface-variant font-medium select-none">No reviewers assigned</span>;
  }

  const getStatusDetails = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'reviewed':
        return {
          icon: 'check',
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200 text-green-700',
          text: 'Approved'
        };
      case 'rejected':
        return {
          icon: 'close',
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200 text-red-700',
          text: 'Rejected'
        };
      case 'pending':
      default:
        return {
          icon: 'schedule',
          iconColor: 'text-amber-700',
          bgColor: 'bg-amber-50 border-amber-200 text-amber-800',
          text: 'Pending'
        };
    }
  };

  const getNormalizedRole = (role) => {
    const r = (role || '').toLowerCase();
    if (r.includes('review')) return 'REVIEW';
    if (r.includes('approv')) return 'APPROVER';
    return 'REVIEW'; // fallback default
  };

  const reviewers = approvers.filter(a => getNormalizedRole(a.role) === 'REVIEW');
  const approverList = approvers.filter(a => getNormalizedRole(a.role) === 'APPROVER');

  const renderGroup = (roleLabel, users) => {
    if (users.length === 0) return null;
    return (
      <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
        {/* Role Label - Shown only once per category */}
        <span className="text-[9px] font-bold text-on-surface-variant/80 tracking-wider uppercase select-none">
          {roleLabel}
        </span>
        
        {/* Row of avatars for this role */}
        <div className="flex flex-row items-center gap-3 justify-center">
          {users.map((app, idx) => {
            const details = getStatusDetails(app.status);
            const nameText = app.name || app.email || 'Reviewer';
            const initials = nameText.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2);

            return (
              <div 
                key={idx} 
                className="flex flex-col items-center gap-1"
                title={`${nameText} (${roleLabel}) - ${details.text}`}
              >
                {/* Avatar Circle */}
                <div className="w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant flex items-center justify-center text-xs font-bold border border-outline-variant/40 shadow-sm transition-transform hover:scale-105">
                  {initials}
                </div>
                
                {/* Status Icon Badge below */}
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-xs ${details.bgColor}`}>
                  <span 
                    className={`material-symbols-outlined ${details.iconColor} select-none`}
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                  >
                    {details.icon}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-row gap-6 py-1 select-none items-start justify-center w-full">
      {renderGroup('REVIEW', reviewers)}
      {renderGroup('APPROVER', approverList)}
    </div>
  );
}

WorkflowProgressGrid.propTypes = {
  approvers: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      role: PropTypes.string,
      status: PropTypes.string, // 'approved', 'rejected', 'pending'
    })
  ).isRequired,
};
