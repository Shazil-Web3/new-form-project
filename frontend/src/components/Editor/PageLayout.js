// components/Editor/PageLayout.js
import React, { useCallback, useRef } from 'react';

const PageLayout = ({
  paperSize,
  pageIndex,
  children,
  onPageClick,
  onKeyDown,
  className = "",
  style = {}
}) => {
  const pageRef = useRef(null);
  const headerRef = useRef(null);
  const contentRef = useRef(null);
  const footerRef = useRef(null);

  const getPageDimensions = useCallback(() => {
    switch (paperSize) {
      case 'A4':
        return { width: '210mm', height: '297mm' };
      case 'Letter':
        return { width: '216mm', height: '279mm' };
      case 'Legal':
        return { width: '216mm', height: '356mm' };
      default:
        return { width: '210mm', height: '297mm' };
    }
  }, [paperSize]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e) => {
    // Call the parent's keydown handler
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [onKeyDown]);

  // Handle page clicks
  const handlePageClick = useCallback((e) => {
    if (onPageClick) {
      onPageClick(e);
    }
  }, [onPageClick]);

  const dimensions = getPageDimensions();

  return (
    <div
      ref={pageRef}
      className={`page ${paperSize.toLowerCase()} ${className}`}
      style={{
        width: dimensions.width,
        minHeight: dimensions.height,
        maxHeight: dimensions.height,
        ...style
      }}
      data-page-index={pageIndex}
      onClick={handlePageClick}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="page-header"
        contentEditable="false"
      >
        {/* Header content will be managed by HeaderFooterManager */}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="page-content"
        contentEditable="true"
        data-page={pageIndex}
      >
        {children}
      </div>

      {/* Footer */}
      <div
        ref={footerRef}
        className="page-footer"
        contentEditable="false"
      >
        <div className="footer-left">
          {/* Footer content will be managed by HeaderFooterManager */}
        </div>
        <div className="footer-right">
          Page <span data-page-num></span>
        </div>
      </div>
    </div>
  );
};

export default PageLayout;