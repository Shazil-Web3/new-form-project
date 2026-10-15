import React from "react";

const ReferencePreviewComponent = ({ system }) => {
  const { referencePreview } = system;
  if (!referencePreview || !referencePreview.show || !referencePreview.ref) return null;

  return (
    <div
      className="reference-preview-card"
      style={{
        position: 'fixed',
        top: referencePreview.top,
        left: referencePreview.left,
        zIndex: 1050,
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '12px',
        maxWidth: '320px',
        minWidth: '220px',
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => referencePreview.onMouseEnter?.()}
      onMouseLeave={() => referencePreview.onMouseLeave?.()}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
        <i className="bi bi-book me-2" style={{ color: '#0d6efd', fontSize: '1.1rem' }}></i>
        <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#212529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {referencePreview.ref.metadata?.title || 'Document Reference'}
        </span>
      </div>
      <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '8px', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {referencePreview.ref.metadata?.snippet ? `"${referencePreview.ref.metadata.snippet}"` : 'Referenced template/document snippet.'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', color: '#adb5bd' }}>
        Click link to view
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FLOATING TOOLBAR (Inline selection pill)
// ═══════════════════════════════════════════════════════════════════════════


export default ReferencePreviewComponent;
export { ReferencePreviewComponent };
