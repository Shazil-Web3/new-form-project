import React, { useState, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './HeaderLogoUpload.css';

const HeaderLogoUpload = ({ 
  pageId, 
  header, 
  logo, 
  onLogoUpload, 
  onLogoRemove 
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const effectiveLogo = logo || header?.logo;
  const hasLogo = Boolean(
    effectiveLogo &&
    (effectiveLogo.preview || (typeof effectiveLogo === 'string' && effectiveLogo.trim() !== '') || effectiveLogo.url)
  );

  // Handle header logo upload
  const handleHeaderImageUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const base64DataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const maxHeight = 40;
        const scale = maxHeight / (img.height || maxHeight);
        const scaledWidth = (img.width || 100) * scale;
        const payload = {
          file,
          preview: base64DataUrl,
          width: scaledWidth,
          height: maxHeight
        };

        onLogoUpload(payload);

        setIsUploading(false);
        if (event?.target) event.target.value = '';
      };
      img.onerror = () => {
        setIsUploading(false);
        if (event?.target) event.target.value = '';
      };
      img.src = base64DataUrl;
    };
    reader.onerror = () => {
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  }, [onLogoUpload]);

  // Handle logo removal
  const handleRemoveLogo = useCallback(() => {
    if (onLogoRemove) {
      onLogoRemove();
    }
  }, [onLogoRemove]);

  return (
    <div className="header-logo-container" style={{ position: 'relative', minHeight: '30px' }}>
      {/* Upload and Remove buttons */}
      <div 
        className="header-logo-buttons" 
        style={{ 
          position: 'absolute', 
          right: '5px', 
          top: '2px',
          display: 'flex',
          gap: '3px',
          zIndex: 1000,
          pointerEvents: 'auto'
        }}
      >
        {/* Hidden file input */}
        <input
          type="file"
          id={`header-image-${pageId}`}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleHeaderImageUpload}
          disabled={isUploading}
        />
        
        {/* Toggle between Remove Logo (when logo exists) and Upload Logo (when no logo exists) */}
        {hasLogo ? (
          <button
            type="button"
            className="btn btn-light btn-sm"
            style={{
              padding: '2px 5px',
              fontSize: '8px',
              lineHeight: '1.05',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              zIndex: 1001,
              position: 'relative',
              pointerEvents: 'auto'
            }}
            onClick={handleRemoveLogo}
            title="Remove Logo"
          >
            <i className="bi bi-x-circle" style={{ fontSize: '10px', marginBottom: '1px' }}></i>
            <span>Remove</span>
            <span>Logo</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-light btn-sm"
            style={{
              padding: '2px 5px',
              fontSize: '8px',
              lineHeight: '1.05',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              zIndex: 1001,
              position: 'relative',
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
            onClick={() => document.getElementById(`header-image-${pageId}`)?.click()}
            disabled={isUploading}
            title="Upload Logo"
          >
            <i className="bi bi-image" style={{ fontSize: '10px', marginBottom: '1px' }}></i>
            {isUploading ? (
              <span>Uploading...</span>
            ) : (
              <>
                <span>Upload</span>
                <span>Logo</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default HeaderLogoUpload;
