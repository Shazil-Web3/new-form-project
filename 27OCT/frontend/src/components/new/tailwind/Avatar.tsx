import React from 'react';
import PropTypes from 'prop-types';

export default function Avatar({ name, imageUrl, size }) {
  const getInitials = (fullName) => {
    if (!fullName) return 'U';
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  if (imageUrl) {
    return (
      <img
        className={`${selectedSize} rounded-full object-cover border border-brand-slate-200`}
        src={imageUrl}
        alt={name || 'Avatar'}
      />
    );
  }

  // Fallback to initials with hash color
  const colors = [
    'bg-blue-500 text-white',
    'bg-purple-500 text-white',
    'bg-indigo-500 text-white',
    'bg-pink-500 text-white',
    'bg-teal-500 text-white',
  ];
  const charSum = (name || 'User').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const selectedColor = colors[charSum % colors.length];

  return (
    <div className={`${selectedSize} rounded-full flex items-center justify-center font-semibold ${selectedColor}`}>
      {getInitials(name)}
    </div>
  );
}

Avatar.propTypes = {
  name: PropTypes.string.isRequired,
  imageUrl: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

Avatar.defaultProps = {
  imageUrl: null,
  size: 'md',
};
