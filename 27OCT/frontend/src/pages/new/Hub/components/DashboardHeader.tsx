/**
 * @file DashboardHeader.jsx
 * @description Page title and subtext headers block for the Unified Dashboard
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

export default function DashboardHeader({ dashboardType }) {
  const getHeaderTitle = () => {
    if (dashboardType === 'templates') return 'Templates';
    if (dashboardType === 'documents') return 'Documents';
    return 'All Files';
  };

  const getHeaderDescription = () => {
    if (dashboardType === 'templates') {
      return 'Manage and create standardized document structures.';
    }
    if (dashboardType === 'documents') {
      return 'View and edit customized documents.';
    }
    return 'Consolidated view of templates and customized documents.';
  };

  return (
    <div className="mb-6 select-none">
      <h2 className="font-display-lg text-display-lg text-on-surface mb-1 font-bold">
        {getHeaderTitle()}
      </h2>
      <p className="text-on-surface-variant font-body-md">
        {getHeaderDescription()}
      </p>
    </div>
  );
}

DashboardHeader.propTypes = {
  dashboardType: PropTypes.oneOf(['all', 'documents', 'templates']).isRequired,
};
