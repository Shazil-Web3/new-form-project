/**
 * EditorToolbar Component
 * Shared toolbar component used by Create and Review modes
 * Provides formatting options, page size, orientation controls
 */

import React from 'react';
import { Button, Dropdown } from 'react-bootstrap';

const EditorToolbar = ({ 
  paperSize = 'A4',
  setPaperSize,
  orientation = 'portrait',
  setOrientation,
  isFullScreen = false,
  toggleFullScreen,
  user
}) => {
  return (
    <div className="editor-toolbar" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      flexWrap: 'wrap', 
      gap: '8px', 
      padding: '8px 12px',
      background: '#f8f9fa',
      borderBottom: '1px solid #dee2e6'
    }}>
      {/* Orientation buttons */}
      <Button
        onClick={() => setOrientation && setOrientation("portrait")}
        disabled={orientation === "portrait"}
        variant={orientation === "portrait" ? "primary" : "outline-secondary"}
        size="sm"
      >
        Portrait
      </Button>
      <Button
        onClick={() => setOrientation && setOrientation("landscape")}
        disabled={orientation === "landscape"}
        variant={orientation === "landscape" ? "primary" : "outline-secondary"}
        size="sm"
      >
        Landscape
      </Button>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 8px' }}></div>

      {/* Paper size dropdown */}
      <Dropdown onSelect={(val) => setPaperSize && setPaperSize(val)}>
        <Dropdown.Toggle variant="outline-secondary" size="sm">
          {paperSize}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item eventKey="A4">A4</Dropdown.Item>
          <Dropdown.Item eventKey="Letter">Letter</Dropdown.Item>
          <Dropdown.Item eventKey="Legal">Legal</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 8px' }}></div>

      {/* Fullscreen toggle */}
      {toggleFullScreen && (
        <Button 
          onClick={toggleFullScreen}
          variant="outline-secondary"
          size="sm"
          title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        >
          <i className={`bi ${isFullScreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
        </Button>
      )}

      {/* User info */}
      {user && (
        <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          {user.name || user.email}
        </div>
      )}
    </div>
  );
};

export default EditorToolbar;
