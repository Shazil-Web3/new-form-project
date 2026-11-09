import React from 'react';

export const TemplateUpdateNotice = ({ notice }) => {
  if (!notice) return null;
  return (
    <div
      className="bg-light p-2 d-flex align-items-center"
      style={{
        borderBottom: '2px solid #faad14',
        borderTop: '1px solid #e0e0e0',
        background: 'linear-gradient(90deg, #fffbe6 0%, #fff3cd 100%)',
        minHeight: '40px',
        paddingLeft: '12px',
        paddingRight: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span style={{ fontSize: '15px' }}>⚡</span>
        <span style={{ fontWeight: 600, color: '#875700' }}>
          New template/document version available:
        </span>
        <span style={{ color: '#ad6800' }}>
          This document uses <strong>{notice.oldTemplate?.name}</strong> v{notice.oldTemplate?.version}.
          {' '}A newer version <strong>v{notice.newTemplate?.version}</strong> is now published.
        </span>
      </div>
    </div>
  );
};

export const DocumentUpdateNotice = ({ notice }) => {
  if (!notice) return null;
  return (
    <div
      className="bg-light p-2 d-flex align-items-center"
      style={{
        borderBottom: '2px solid #1890ff',
        borderTop: '1px solid #e0e0e0',
        background: 'linear-gradient(90deg, #e6f7ff 0%, #bae7ff 100%)',
        minHeight: '40px',
        paddingLeft: '12px',
        paddingRight: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span style={{ fontSize: '15px' }}>ℹ️</span>
        <span style={{ fontWeight: 600, color: '#0050b3' }}>
          Newer revised version of this document is available:
        </span>
        <span style={{ color: '#096dd9' }}>
          You are viewing <strong>{notice.oldDocument?.title}</strong> v{notice.oldDocument?.version}.
          {' '}A newer version <strong>v{notice.newDocument?.version}</strong> is now published.
        </span>
      </div>
    </div>
  );
};

export default { TemplateUpdateNotice, DocumentUpdateNotice };
