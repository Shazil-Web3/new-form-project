/**
 * EditorTOC Component
 * Table of Contents component for navigating the document
 * Shows headings and allows jumping to sections
 */

import React, { useState, useEffect } from 'react';
import { calculateTOCNumbers } from '../../../../utils/tocUtils';

const EditorTOC = ({ editorRef, sidebarWidth = 65, setSidebarWidth }) => {
  const [tocItems, setTocItems] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (!editorRef?.current) return;

    // Extract headings from the editor
    const updateTOC = () => {
      const headings = Array.from(editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const tocNumbers = calculateTOCNumbers(headings);
      const items = headings.map((heading, index) => {
        const id = heading.id || `heading-${index}`;
        const tocNum = tocNumbers[index];
        if (heading.id !== id) heading.id = id;
        if (heading.getAttribute("data-toc-number") !== tocNum) {
          heading.setAttribute("data-toc-number", tocNum);
        }
        return {
          id,
          text: (heading.textContent || heading.innerText || "").trim(),
          level: parseInt(heading.tagName.substring(1)),
          element: heading,
          tocNumber: tocNum
        };
      });
      setTocItems(items);
    };

    updateTOC();

    // Update TOC when content changes
    const observer = new MutationObserver(updateTOC);
    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [editorRef]);

  const handleTOCClick = (item) => {
    const headingEl = item.element || document.getElementById(item.id);
    if (headingEl) {
      let container = headingEl.parentElement;
      while (container && container !== document.body && container !== document.documentElement) {
        const style = window.getComputedStyle(container);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') && container.scrollHeight > container.clientHeight) {
          break;
        }
        container = container.parentElement;
      }

      const headingRect = headingEl.getBoundingClientRect();
      const topOffset = 180;

      if (container && container !== document.body && container !== document.documentElement) {
        const containerRect = container.getBoundingClientRect();
        const targetScrollTop = container.scrollTop + (headingRect.top - containerRect.top) - topOffset;
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      } else {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScrollTop = currentScrollTop + headingRect.top - topOffset;
        window.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      }
    }
  };

  if (isCollapsed) {
    return (
      <div style={{
        width: '40px',
        background: '#f8f9fa',
        borderRight: '1px solid #dee2e6',
        padding: '10px 5px'
      }}>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px'
          }}
          title="Expand TOC"
        >
          ☰
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: `${sidebarWidth}px`,
      background: '#f8f9fa',
      borderRight: '1px solid #dee2e6',
      padding: '10px',
      overflowY: 'auto',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <strong>Table of Contents</strong>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px'
          }}
          title="Collapse TOC"
        >
          ✕
        </button>
      </div>

      {tocItems.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          No headings found
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {tocItems.map((item, index) => (
            <li
              key={index}
              style={{
                paddingLeft: `${(Math.min(item.level, 3) - 1) * 12}px`,
                marginBottom: '8px',
                cursor: 'pointer',
                fontSize: item.level === 1 ? '14px' : '13px',
                fontWeight: item.level === 1 ? 'bold' : 'normal'
              }}
              onClick={() => handleTOCClick(item)}
            >
              <strong>{item.tocNumber}</strong> {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EditorTOC;
