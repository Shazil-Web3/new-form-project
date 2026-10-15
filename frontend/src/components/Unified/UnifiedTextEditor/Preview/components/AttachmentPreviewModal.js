import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Modal, Button, Spin, Space, Tag, Typography, Tooltip, Alert, Card, Empty 
} from 'antd';
import { 
  DownloadOutlined, EyeOutlined, PlayCircleOutlined, 
  SoundOutlined, FilePdfOutlined, FileImageOutlined, 
  FileWordOutlined, FileExcelOutlined, FileTextOutlined, 
  FileZipOutlined, FileOutlined, ZoomInOutlined, 
  ZoomOutOutlined, RotateRightOutlined, UndoOutlined, 
  FullscreenOutlined, FullscreenExitOutlined, CloseOutlined,
  CopyOutlined, CheckOutlined, LinkOutlined
} from '@ant-design/icons';
import apiClient from '../../../../../api/apiClient';
import moment from 'moment';
import './AttachmentPreviewModal.css';

const { Text, Title, Paragraph } = Typography;

// Determine category and preview mode based on file type and name
export const getAttachmentCategory = (fileType = '', fileName = '') => {
  const mime = String(fileType || '').toLowerCase().trim();
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('text/') || 
    mime === 'application/json' || 
    ['txt', 'json', 'csv', 'md', 'log', 'xml'].includes(ext)
  ) {
    return 'text';
  }
  if (
    mime.includes('word') || 
    mime.includes('officedocument.wordprocessing') || 
    ['doc', 'docx'].includes(ext)
  ) {
    return 'word';
  }
  if (
    mime.includes('excel') || 
    mime.includes('spreadsheet') || 
    mime.includes('officedocument.spreadsheetml') || 
    ['xls', 'xlsx', 'csv'].includes(ext)
  ) {
    return 'excel';
  }
  if (
    mime.includes('zip') || 
    mime.includes('compressed') || 
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return 'archive';
  }
  return 'file';
};

// Helper for category badge color & label
export const getCategoryBadge = (category) => {
  switch (category) {
    case 'image':
      return { color: 'orange', label: 'Image Preview', icon: <FileImageOutlined /> };
    case 'video':
      return { color: 'magenta', label: 'Video Player', icon: <PlayCircleOutlined /> };
    case 'audio':
      return { color: 'purple', label: 'Audio Track', icon: <SoundOutlined /> };
    case 'pdf':
      return { color: 'red', label: 'PDF Document', icon: <FilePdfOutlined /> };
    case 'word':
      return { color: 'blue', label: 'Word Document', icon: <FileWordOutlined /> };
    case 'excel':
      return { color: 'green', label: 'Spreadsheet', icon: <FileExcelOutlined /> };
    case 'text':
      return { color: 'cyan', label: 'Text / Code', icon: <FileTextOutlined /> };
    case 'archive':
      return { color: 'gold', label: 'Archive / Zip', icon: <FileZipOutlined /> };
    default:
      return { color: 'default', label: 'File Attachment', icon: <FileOutlined /> };
  }
};

const AttachmentPreviewModal = ({ 
  visible, 
  attachment, 
  onClose, 
  onDownload,
  cachedBlobUrl = null
}) => {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Image manipulation controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const ownCreatedBlobUrlRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const category = attachment ? getAttachmentCategory(attachment.file_type, attachment.file_name) : 'file';
  const badgeInfo = getCategoryBadge(category);

  // Reset image controls
  const resetImageControls = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setIsFullscreen(false);
  }, []);

  // Cleanup internally created blob URL only
  const cleanupInternalBlobUrl = useCallback(() => {
    if (ownCreatedBlobUrlRef.current) {
      URL.revokeObjectURL(ownCreatedBlobUrlRef.current);
      ownCreatedBlobUrlRef.current = null;
    }
  }, []);

  // Fetch binary blob directly from server
  const fetchBlobFromServer = useCallback(async (attId, fallbackMime) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        `/api/attachments/view/${attId}`, 
        { responseType: 'blob' }
      );

      let blob = response.data;
      if (blob && blob.type === 'application/json') {
        try {
          const text = await blob.text();
          const json = JSON.parse(text);
          setError(json.error || 'Preview unavailable');
          setBlobUrl(null);
          return null;
        } catch (_) {}
      }

      if (!(blob instanceof Blob)) {
        blob = new Blob([response.data], { type: fallbackMime || 'application/octet-stream' });
      }

      cleanupInternalBlobUrl();
      const objectUrl = URL.createObjectURL(blob);
      ownCreatedBlobUrlRef.current = objectUrl;
      setBlobUrl(objectUrl);

      if (category === 'text') {
        try {
          const text = await blob.text();
          setTextContent(text);
        } catch (e) {
          console.error('Failed to read text content:', e);
        }
      }

      return objectUrl;
    } catch (err) {
      console.error('Failed to fetch attachment media:', err);
      setError('Could not load file preview. You can download the file directly.');
      setBlobUrl(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [category, cleanupInternalBlobUrl]);

  // Handle fallback if an image or media element fails to load from cached/provided URL
  const handleMediaLoadError = useCallback(() => {
    if (!attachment?.id) {
      setError('Could not display media preview.');
      return;
    }
    console.warn('Cached media failed to render, fetching fresh blob from backend for attachment:', attachment.id);
    fetchBlobFromServer(attachment.id, attachment.file_type);
  }, [attachment, fetchBlobFromServer]);

  // Fetch or setup media URL when attachment changes or modal opens
  useEffect(() => {
    if (!visible || !attachment) {
      cleanupInternalBlobUrl();
      setBlobUrl(null);
      setTextContent('');
      setError(null);
      resetImageControls();
      return;
    }

    let isSubscribed = true;
    resetImageControls();

    const loadMedia = async () => {
      // If cached blob URL is provided, use it
      if (cachedBlobUrl) {
        setBlobUrl(cachedBlobUrl);
        return;
      }

      // If attachment has local file or existing blobUrl
      if (attachment.blobUrl) {
        setBlobUrl(attachment.blobUrl);
        return;
      }

      if (attachment.file instanceof File || attachment.file instanceof Blob) {
        cleanupInternalBlobUrl();
        const localUrl = URL.createObjectURL(attachment.file);
        ownCreatedBlobUrlRef.current = localUrl;
        if (isSubscribed) {
          setBlobUrl(localUrl);
        }
        return;
      }

      // For non-previewable formats, don't need to load the blob unless requested
      if (['word', 'excel', 'archive', 'file'].includes(category)) {
        setLoading(false);
        return;
      }

      // Otherwise fetch from server
      await fetchBlobFromServer(attachment.id, attachment.file_type);
    };

    loadMedia();

    return () => {
      isSubscribed = false;
      // Pause any playing media
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [visible, attachment, cachedBlobUrl, category, resetImageControls, cleanupInternalBlobUrl, fetchBlobFromServer]);

  // Clean up object URL when unmounting
  useEffect(() => {
    return () => {
      cleanupInternalBlobUrl();
    };
  }, [cleanupInternalBlobUrl]);

  // Handle zoom in/out/rotate
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetZoom = () => resetImageControls();

  // Handle text copy
  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Human readable size helper
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!attachment) return null;

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={category === 'video' || category === 'pdf' ? 920 : 800}
      centered
      destroyOnClose
      className={`attachment-preview-modal ${isFullscreen ? 'fullscreen-preview' : ''}`}
      title={
        <div className="preview-modal-header">
          <div className="preview-modal-header-left">
            <span className="preview-header-icon">{badgeInfo.icon}</span>
            <div className="preview-header-text">
              <Tooltip title={attachment.file_name}>
                <div className="preview-header-title">{attachment.file_name}</div>
              </Tooltip>
              <Space size={6} className="preview-header-tags">
                <Tag color={badgeInfo.color}>{badgeInfo.label}</Tag>
                <Tag>{formatSize(attachment.file_size)}</Tag>
                {attachment.uploaded_by_name && (
                  <Tag color="blue">{attachment.uploaded_by_name}</Tag>
                )}
                {attachment.uploaded_at && (
                  <span className="preview-header-date">
                    {moment(attachment.uploaded_at).format('MMM D, YYYY h:mm A')}
                  </span>
                )}
              </Space>
            </div>
          </div>
          <div className="preview-modal-header-actions">
            {onDownload && (
              <Button 
                type="primary" 
                icon={<DownloadOutlined />} 
                onClick={() => onDownload(attachment)}
                className="preview-download-btn"
              >
                Download
              </Button>
            )}
            {blobUrl && category !== 'text' && category !== 'file' && (
              <Tooltip title="Open full media in new tab">
                <Button 
                  icon={<LinkOutlined />} 
                  onClick={() => window.open(blobUrl, '_blank')}
                />
              </Tooltip>
            )}
          </div>
        </div>
      }
    >
      <div className="preview-modal-body">
        {loading ? (
          <div className="preview-loading-container">
            <Spin size="large" />
            <div className="preview-loading-text">Loading media preview...</div>
          </div>
        ) : error ? (
          <div className="preview-error-container">
            <Alert
              message="Preview Unavailable"
              description={error}
              type="warning"
              showIcon
              action={
                onDownload ? (
                  <Button size="small" type="primary" onClick={() => onDownload(attachment)}>
                    Download File
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            {/* 1. VIDEO PREVIEW */}
            {category === 'video' && blobUrl && (
              <div className="video-player-container">
                <video
                  ref={videoRef}
                  src={blobUrl}
                  controls
                  autoPlay
                  playsInline
                  onError={handleMediaLoadError}
                  className="preview-video-element"
                >
                  Your browser does not support the video tag.
                </video>
                <div className="video-meta-hint">
                  <PlayCircleOutlined /> Video playing in interactive in-app player. You can seek, change volume, and toggle fullscreen.
                </div>
              </div>
            )}

            {/* 2. IMAGE PREVIEW */}
            {category === 'image' && blobUrl && (
              <div className="image-preview-container">
                <div className="image-toolbar">
                  <Space size="small">
                    <Tooltip title="Zoom In">
                      <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                    </Tooltip>
                    <Tooltip title="Zoom Out">
                      <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
                    </Tooltip>
                    <Tooltip title="Rotate 90°">
                      <Button icon={<RotateRightOutlined />} onClick={handleRotate} />
                    </Tooltip>
                    <Tooltip title="Reset View">
                      <Button icon={<UndoOutlined />} onClick={handleResetZoom} />
                    </Tooltip>
                    <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                      <Button 
                        icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
                        onClick={() => setIsFullscreen(prev => !prev)} 
                      />
                    </Tooltip>
                    <span className="zoom-level-indicator">{Math.round(zoom * 100)}%</span>
                  </Space>
                </div>
                <div className="image-viewport">
                  <img
                    src={blobUrl}
                    alt={attachment.file_name}
                    className="preview-image-element"
                    onError={handleMediaLoadError}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                  />
                </div>
              </div>
            )}

            {/* 3. AUDIO PREVIEW */}
            {category === 'audio' && blobUrl && (
              <div className="audio-player-card">
                <div className="audio-visualizer-box">
                  <SoundOutlined className="audio-center-icon" />
                  <div className="audio-wave-anim">
                    <span className="wave-bar bar-1"></span>
                    <span className="wave-bar bar-2"></span>
                    <span className="wave-bar bar-3"></span>
                    <span className="wave-bar bar-4"></span>
                    <span className="wave-bar bar-5"></span>
                    <span className="wave-bar bar-6"></span>
                    <span className="wave-bar bar-7"></span>
                    <span className="wave-bar bar-8"></span>
                  </div>
                  <div className="audio-track-title">{attachment.file_name}</div>
                  <div className="audio-track-sub">{formatSize(attachment.file_size)} • Audio Recording / Media</div>
                </div>
                <div className="audio-control-wrapper">
                  <audio
                    ref={audioRef}
                    src={blobUrl}
                    controls
                    autoPlay
                    onError={handleMediaLoadError}
                    className="preview-audio-element"
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              </div>
            )}

            {/* 4. PDF PREVIEW */}
            {category === 'pdf' && blobUrl && (
              <div className="pdf-preview-container">
                <iframe
                  src={`${blobUrl}#toolbar=1&navpanes=0`}
                  title={attachment.file_name}
                  onError={handleMediaLoadError}
                  className="preview-pdf-iframe"
                />
              </div>
            )}

            {/* 5. TEXT / CODE PREVIEW */}
            {category === 'text' && (
              <div className="text-preview-container">
                <div className="text-preview-header">
                  <span className="text-line-count">
                    {textContent ? `${textContent.split('\n').length} lines` : 'Plain text'}
                  </span>
                  <Button 
                    size="small" 
                    icon={copied ? <CheckOutlined /> : <CopyOutlined />} 
                    onClick={handleCopyText}
                  >
                    {copied ? 'Copied' : 'Copy Text'}
                  </Button>
                </div>
                <pre className="text-preview-content">
                  <code>{textContent || 'Loading content...'}</code>
                </pre>
              </div>
            )}

            {/* 6. NON-PREVIEWABLE OR DOCUMENT (Word, Excel, Zip, etc.) */}
            {['word', 'excel', 'archive', 'file'].includes(category) && (
              <div className="document-fallback-card">
                <div className="fallback-icon-wrapper">
                  {badgeInfo.icon}
                </div>
                <Title level={4} className="fallback-title">{attachment.file_name}</Title>
                <Paragraph className="fallback-desc">
                  Direct in-browser interactive preview is not available for this {badgeInfo.label.toLowerCase()} format. 
                  You can download the original file to view and edit it on your machine.
                </Paragraph>
                <Space size="middle" className="fallback-details">
                  <Tag color="blue">Size: {formatSize(attachment.file_size)}</Tag>
                  <Tag color="cyan">Type: {(attachment.file_type || 'Unknown').toUpperCase()}</Tag>
                  {attachment.uploaded_by_name && (
                    <Tag color="purple">Uploaded by: {attachment.uploaded_by_name}</Tag>
                  )}
                </Space>
                <div className="fallback-action-container">
                  {onDownload && (
                    <Button 
                      type="primary" 
                      size="large" 
                      icon={<DownloadOutlined />} 
                      onClick={() => onDownload(attachment)}
                    >
                      Download {attachment.file_name}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default AttachmentPreviewModal;
