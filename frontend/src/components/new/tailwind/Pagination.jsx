import React from 'react';
import PropTypes from 'prop-types';

export default function Pagination({ totalEntries, currentPage, pageSize, onPageChange }) {
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalEntries);

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 select-none">
      <div className="text-xs text-on-surface-variant">
        Showing <span className="font-semibold text-on-surface">{startIdx}</span> to{' '}
        <span className="font-semibold text-on-surface">{endIdx}</span> of{' '}
        <span className="font-semibold text-on-surface">{totalEntries}</span> entries
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded text-xs text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Previous
        </button>
        {getPageNumbers().map((pageNum) => {
          const isSelected = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded text-xs text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Next
        </button>
      </div>
    </div>
  );
}

Pagination.propTypes = {
  totalEntries: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};
