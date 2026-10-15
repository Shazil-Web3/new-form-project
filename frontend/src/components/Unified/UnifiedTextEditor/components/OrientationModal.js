import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const OrientationModal = ({
  show,
  onHide,
  targetOrientation,
  currentPage,
  onConfirmThisPage,
  onConfirmWholeDocument,
}) => {
  const targetLabel = targetOrientation === 'landscape' ? 'Landscape' : 'Portrait';

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1.2rem', fontWeight: 600 }}>
          Change Page Orientation
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '20px 24px' }}>
        <p style={{ marginBottom: '16px', fontSize: '1rem', color: '#333' }}>
          You are changing the orientation to <strong>{targetLabel}</strong>.
          Where would you like to apply this orientation change?
        </p>
        <div
          style={{
            background: '#f8f9fa',
            padding: '12px 16px',
            borderRadius: '6px',
            border: '1px solid #e9ecef',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
            Active Page: <strong>Page {currentPage}</strong>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer style={{ gap: '8px' }}>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="outline-primary"
          onClick={() => {
            onConfirmThisPage();
            onHide();
          }}
        >
          This Page Only (Page {currentPage})
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onConfirmWholeDocument();
            onHide();
          }}
        >
          Whole Document
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrientationModal;
