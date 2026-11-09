import React from 'react';
import PropTypes from 'prop-types';

export default function Card({ children, leftBorderColor, onClick, className }) {
  const borderClasses = {
    green: 'border-l-4 border-l-brand-green-500',
    orange: 'border-l-4 border-l-brand-orange-500',
    red: 'border-l-4 border-l-brand-red-500',
    blue: 'border-l-4 border-l-brand-blue-500',
    slate: 'border-l-4 border-l-brand-slate-200',
  };

  const selectedBorder = borderClasses[leftBorderColor] || '';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-brand-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-5 relative flex flex-col justify-between ${selectedBorder} ${
        onClick ? 'cursor-pointer hover:scale-[1.01]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  leftBorderColor: PropTypes.oneOf(['green', 'orange', 'red', 'blue', 'slate']),
  onClick: PropTypes.func,
  className: PropTypes.string,
};

Card.defaultProps = {
  leftBorderColor: 'slate',
  onClick: null,
  className: '',
};
