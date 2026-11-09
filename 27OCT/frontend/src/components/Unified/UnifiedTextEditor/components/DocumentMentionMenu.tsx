import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../../../api/apiClient';
import { Spin } from 'antd';
import { FileTextOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './DocumentMentionMenu.css';

/**
 * Floating Document Mention Popover for inserting hyperlinks to published documents.
 */
export default function DocumentMentionMenu({
  position,
  initialQuery = '',
  onSelect,
  onClose
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Sync initialQuery if updated from editor
  useEffect(() => {
    if (initialQuery !== undefined) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  // Fetch published documents on mount
  useEffect(() => {
    let isMounted = true;
    const fetchPublishedDocs = async () => {
      try {
        setLoading(true);
        // Try dedicated published-documents endpoint first, fallback to all-docs
        let response;
        try {
          response = await apiClient.get('/api/published-documents');
        } catch (err) {
          response = await apiClient.get('/api/all-docs');
        }

        if (isMounted && response?.data) {
          const raw = Array.isArray(response.data) ? response.data : response.data.documents || [];
          const published = raw.filter(
            doc => (doc.status || '').toLowerCase() === 'published' || (doc.status || '').toLowerCase() === 'revised'
          );
          setDocuments(published);
        }
      } catch (error) {
        console.error('Failed to fetch published documents for mention menu:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPublishedDocs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter documents based on searchQuery
  const filteredDocs = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(doc => {
      const title = (doc.title || '').toLowerCase();
      const id = String(doc.document_id || '').toLowerCase();
      const version = String(doc.version || '').toLowerCase();
      const author = String(doc.created_by_name || '').toLowerCase();
      return title.includes(q) || id.includes(q) || version.includes(q) || author.includes(q);
    });
  }, [documents, searchQuery]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredDocs]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (filteredDocs.length > 0 ? (prev + 1) % filteredDocs.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (filteredDocs.length > 0 ? (prev - 1 + filteredDocs.length) % filteredDocs.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredDocs[selectedIndex]) {
          onSelect(filteredDocs[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [filteredDocs, selectedIndex, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('.doc-mention-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Compute popover style to avoid clipping off-screen
  const menuStyle = useMemo(() => {
    const top = Math.min(position?.top || 0, window.innerHeight - 360);
    const left = Math.min(position?.left || 0, window.innerWidth - 360);
    return {
      top: `${Math.max(10, top)}px`,
      left: `${Math.max(10, left)}px`
    };
  }, [position]);

  return (
    <div
      ref={menuRef}
      className="doc-mention-menu-container"
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="doc-mention-header">
        <FileTextOutlined className="doc-mention-header-icon" />
        <span className="doc-mention-header-title">Link Published Document</span>
        <span className="doc-mention-header-badge">
          {filteredDocs.length} {filteredDocs.length === 1 ? 'doc' : 'docs'}
        </span>
      </div>

      <div className="doc-mention-search-box">
        <SearchOutlined className="doc-mention-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="doc-mention-search-input"
          placeholder="Search published documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading ? (
        <div className="doc-mention-empty">
          <Spin size="small" /> <span style={{ marginLeft: 8 }}>Loading documents...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="doc-mention-empty">
          No published documents found matching &ldquo;{searchQuery}&rdquo;
        </div>
      ) : (
        <ul ref={listRef} className="doc-mention-list">
          {filteredDocs.map((doc, idx) => (
            <li
              key={doc.document_id || idx}
              className={`doc-mention-item ${idx === selectedIndex ? 'active' : ''}`}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => onSelect(doc)}
            >
              <div className="doc-mention-item-main">
                <div className="doc-mention-item-icon">
                  <FileTextOutlined />
                </div>
                <div className="doc-mention-item-info">
                  <span className="doc-mention-item-title" title={doc.title}>
                    {doc.title || 'Untitled Document'}
                  </span>
                  <div className="doc-mention-item-sub">
                    <span>ID: #{doc.document_id}</span>
                    {doc.created_by_name && <span>• {doc.created_by_name}</span>}
                  </div>
                </div>
              </div>
              <div className="doc-mention-item-meta">
                <span className="doc-mention-version-tag">v{doc.version || '1.0'}</span>
                <span style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircleOutlined /> Published
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

DocumentMentionMenu.propTypes = {
  position: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number
  }).isRequired,
  initialQuery: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};
