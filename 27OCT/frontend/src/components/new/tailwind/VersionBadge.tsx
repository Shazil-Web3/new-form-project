import React from 'react';
import PropTypes from 'prop-types';

export default function VersionBadge({ version }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue-50 text-brand-blue-500 border border-brand-blue-100 select-none">
      v{version || '1.0'}
    </span>
  );
}

VersionBadge.propTypes = {
  version: PropTypes.string.isRequired,
};
