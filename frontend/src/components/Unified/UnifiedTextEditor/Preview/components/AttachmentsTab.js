import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../../../../api/apiClient';
import { 
  Upload, Button, Card, Table, Space, Tag, Modal, 
  message, Tooltip, Alert, Progress, Segmented, Input, Row, Col, Typography, Empty 
} from 'antd';
import { confirmAlert, successAlert, errorAlert } from '../../../../../utils/alerts';
import { 
  PaperClipOutlined, InboxOutlined, DeleteOutlined, 
  DownloadOutlined, EyeOutlined, PlayCircleOutlined, 
  SoundOutlined, FilePdfOutlined, FileWordOutlined, 
  FileExcelOutlined, FileImageOutlined, FileOutlined, 
  LoadingOutlined, ExclamationCircleOutlined, 
  UnorderedListOutlined, AppstoreOutlined, SearchOutlined,
  PlaySquareOutlined, PictureOutlined, AudioOutlined
} from '@ant-design/icons';
import moment from 'moment';
import AttachmentPreviewModal, { getAttachmentCategory, getCategoryBadge } from './AttachmentPreviewModal';
import './AttachmentsTab.css';

const { Dragger } = Upload;
const { Text, Title } = Typography;

const AttachmentsTab = ({ 
  associationType, 
  associationId, 
  templateId, // Optional template ID to inherit attachments from
  canEdit = false,
  initialAttachments = [],
  onAttachmentsChange,
  status = 'draft' // Prop to handle conditional delete based on status
}) => {
  const [attachments, setAttachments] = useState(initialAttachments || []);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // View Mode & Search Filter
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');

  // Preview Modal State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  
  // Thumbnail blob URLs cache for instant display
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const thumbnailUrlsRef = useRef({});

  // Sync initialAttachments if in temporary/creation mode
  useEffect(() => {
    const hasValidId = associationId && associationId !== 'null' && associationId !== 'undefined';
    if (!hasValidId && Array.isArray(initialAttachments) && initialAttachments.length > 0) {
      setAttachments(initialAttachments);
    }
  }, [initialAttachments, associationId]);

  // Fetch single thumbnail helper
  const fetchThumbnailForAttachment = useCallback(async (att) => {
    if (!att?.id) return;
    try {
      const res = await apiClient.get(`/api/attachments/view/${att.id}`, { responseType: 'blob' });
      let blob = res.data;
      if (blob && blob.type === 'application/json') return;
      if (!(blob instanceof Blob)) {
        blob = new Blob([res.data], { type: att.file_type || 'image/jpeg' });
      }
      const url = URL.createObjectURL(blob);
      thumbnailUrlsRef.current[att.id] = url;
      setThumbnailUrls(prev => ({ ...prev, [att.id]: url }));
    } catch (e) {
      // Ignore thumbnail loading failure
    }
  }, []);

  // Fetch attachments
  const fetchAttachments = useCallback(async () => {
    const hasValidId = associationId && associationId !== 'null' && associationId !== 'undefined';
    
    if (!hasValidId) {
      // In creation mode, we don't fetch from server, we rely on local state or parent state
      return;
    }

    setLoading(true);
    try {
      let docAttachments = [];
      let inheritedAttachments = [];

      // 1. Fetch direct attachments
      const response = await apiClient.get(`/api/attachments/${associationType}/${associationId}`);
      docAttachments = response.data || [];

      // 2. Fetch inherited template attachments if templateId is provided
      if (templateId && templateId !== 'null' && templateId !== 'undefined') {
        const response = await apiClient.get(`/api/attachments/template/${templateId}`);
        inheritedAttachments = response.data || [];
      }

      // 3. Combine lists. Mark template attachments as inherited (read-only)
      const combined = [
        ...inheritedAttachments.map(a => ({ ...a, isInherited: true })),
        ...docAttachments
      ];

      setAttachments(combined);

      // Notify parent ONLY of the document's own uploaded attachments
      if (onAttachmentsChange) {
        onAttachmentsChange(docAttachments);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
      message.error('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [associationType, associationId, templateId, onAttachmentsChange]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Load and cache thumbnails for image attachments
  useEffect(() => {
    let isMounted = true;

    attachments.forEach(async (att) => {
      const category = getAttachmentCategory(att.file_type, att.file_name);
      if (category === 'image' && att.id && !thumbnailUrlsRef.current[att.id]) {
        try {
          const res = await apiClient.get(`/api/attachments/view/${att.id}`, { responseType: 'blob' });
          if (!isMounted) return;
          let blob = res.data;
          if (blob && blob.type === 'application/json') return;
          if (!(blob instanceof Blob)) {
            blob = new Blob([res.data], { type: att.file_type || 'image/jpeg' });
          }
          const url = URL.createObjectURL(blob);
          thumbnailUrlsRef.current[att.id] = url;
          setThumbnailUrls(prev => ({ ...prev, [att.id]: url }));
        } catch (e) {
          // Ignore thumbnail loading failure
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [attachments]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbnailUrlsRef.current).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Helper to get matching file-type icons
  const getFileIcon = (fileType, fileName) => {
    const category = getAttachmentCategory(fileType, fileName);
    switch (category) {
      case 'image':
        return <FileImageOutlined className="file-icon image-color" />;
      case 'video':
        return <PlayCircleOutlined className="file-icon video-color" />;
      case 'audio':
        return <SoundOutlined className="file-icon audio-color" />;
      case 'pdf':
        return <FilePdfOutlined className="file-icon pdf-color" />;
      case 'word':
        return <FileWordOutlined className="file-icon docx-color" />;
      case 'excel':
        return <FileExcelOutlined className="file-icon excel-color" />;
      default:
        return <FileOutlined className="file-icon default-color" />;
    }
  };

  // Convert file size to human-readable string
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file upload
  const handleUpload = async (file) => {
    if (file.size > 100 * 1024 * 1024) {
      message.error(`${file.name} exceeds the maximum allowed size of 100MB.`);
      return false;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('association_type', associationType);
      formData.append('association_id', associationId || '');

      setUploadProgress(30);

      const response = await apiClient.post('/api/attachments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(Math.min(95, 30 + Math.round(percentCompleted * 0.65)));
        }
      });

      if (response.data?.success || response.status === 201 || response.status === 200) {
        setUploadProgress(100);
        message.success(`${file.name} uploaded successfully.`);

        // If local file is image, cache its object URL immediately
        const uploadedAtt = response.data.attachment;
        if (file.type.startsWith('image/') && uploadedAtt?.id) {
          const localUrl = URL.createObjectURL(file);
          thumbnailUrlsRef.current[uploadedAtt.id] = localUrl;
          setThumbnailUrls(prev => ({ ...prev, [uploadedAtt.id]: localUrl }));
        }

        // If associationId is falsy (creating a template or document), add it to tempAttachments state
        const isTemporary = !associationId || associationId === 'null' || associationId === 'undefined';
        if (isTemporary) {
          setAttachments(prev => {
            const next = [...prev, uploadedAtt];
            if (onAttachmentsChange) {
              onAttachmentsChange(next);
            }
            return next;
          });
        } else {
          // If associationId exists, refetch all attachments mapped to it
          fetchAttachments();
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const serverMsg = error?.response?.data?.error || error?.response?.data?.message;
      message.error(serverMsg || `Failed to upload ${file.name}`);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 300);
    }
    return false; // Prevent Ant Design dragger from auto-uploading
  };

  // Handle attachment deletion
  const handleDelete = (attachment) => {
    if (!attachment || !attachment.id) {
      errorAlert('Cannot delete', 'Invalid attachment ID');
      return;
    }

    confirmAlert(
      'Are you sure?',
      `Delete ${attachment.file_name}? This action cannot be undone.`,
      'Yes, Delete',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await apiClient.delete(`/api/attachments/${attachment.id}`);
          if (response.data?.success || response.status === 200 || response.status === 204) {
            successAlert('Deleted!', 'Attachment deleted successfully');
            
            // Clean up cached thumbnail
            if (thumbnailUrlsRef.current[attachment.id]) {
              URL.revokeObjectURL(thumbnailUrlsRef.current[attachment.id]);
              delete thumbnailUrlsRef.current[attachment.id];
            }

            // Immediately remove from local state
            setAttachments(prev => {
              const next = prev.filter(a => a.id !== attachment.id);
              if (onAttachmentsChange) {
                onAttachmentsChange(next);
              }
              return next;
            });

            const hasValidId = associationId && associationId !== 'null' && associationId !== 'undefined';
            if (hasValidId) {
              fetchAttachments();
            }
          }
        } catch (error) {
          console.error('Delete failed:', error);
          const errorMsg = error.response?.data?.error || error.message || 'Failed to delete attachment';
          errorAlert('Delete Failed', errorMsg);
        }
      }
    });
  };

  // Open rich in-app interactive preview modal
  const handleOpenPreview = (attachment) => {
    setSelectedAttachment(attachment);
    setPreviewVisible(true);
  };

  // Download file securely
  const handleDownloadSecurely = async (attachment) => {
    try {
      const response = await apiClient.get(
        `/api/attachments/download/${attachment.id}`, 
        { responseType: 'blob' }
      );
      
      let blob = response.data;
      if (!(blob instanceof Blob)) {
        blob = new Blob([response.data], { type: attachment.file_type || 'application/octet-stream' });
      }
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name || 'attachment');
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to download file securely:', err);
      message.error('Failed to download file');
    }
  };

  // Filter attachments based on search
  const filteredAttachments = attachments.filter(att => 
    (att.file_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ant Design Table Columns
  const columns = [
    {
      title: 'No.',
      key: 'index',
      width: 60,
      align: 'center',
      render: (text, record) => {
        const globalIndex = attachments.findIndex(a => a.id === record.id);
        return <span className="attachment-index-number">{globalIndex + 1}</span>;
      }
    },
    {
      title: 'Preview',
      key: 'thumbnail',
      width: 76,
      align: 'center',
      render: (_, record) => {
        const category = getAttachmentCategory(record.file_type, record.file_name);
        const thumbUrl = thumbnailUrls[record.id];

        return (
          <div 
            className={`attachment-table-thumb thumb-${category}`}
            onClick={() => handleOpenPreview(record)}
            title="Click to preview"
          >
            {category === 'image' && thumbUrl ? (
              <img 
                src={thumbUrl} 
                alt={record.file_name} 
                className="thumb-img" 
                onError={() => fetchThumbnailForAttachment(record)}
              />
            ) : category === 'video' ? (
              <div className="thumb-video-icon">
                <PlayCircleOutlined />
                <span className="thumb-badge">VIDEO</span>
              </div>
            ) : category === 'audio' ? (
              <div className="thumb-audio-icon">
                <SoundOutlined />
                <span className="thumb-badge">AUDIO</span>
              </div>
            ) : (
              getFileIcon(record.file_type, record.file_name)
            )}
            <div className="thumb-hover-overlay">
              <EyeOutlined />
            </div>
          </div>
        );
      }
    },
    {
      title: 'File Details',
      key: 'file',
      render: (_, record) => {
        const category = getAttachmentCategory(record.file_type, record.file_name);
        const badge = getCategoryBadge(category);
        return (
          <div className="file-info-cell">
            <div 
              className="file-name clickable-preview" 
              onClick={() => handleOpenPreview(record)}
              title="Click to preview"
            >
              {record.file_name}
            </div>
            <div className="file-meta-sub">
              <span>{formatSize(record.file_size)}</span>
              <span className="meta-dot">•</span>
              <Tag color={badge.color} className="table-type-tag">{badge.label}</Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploaded_by_name',
      key: 'uploaded_by',
      render: (text, record) => (
        <Space size="small" wrap>
          <Tag color="blue">{text || 'System User'}</Tag>
          {record.isInherited && <Tag color="gold">Template Inherited</Tag>}
        </Space>
      )
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 140,
      render: (_, record) => {
        const isTemporary = !associationId || associationId === 'null' || associationId === 'undefined';
        const canDelete = canEdit && !record.isInherited && (
          ['draft', 'pending_revision', 'temp'].includes(status) || 
          isTemporary
        );
        const category = getAttachmentCategory(record.file_type, record.file_name);

        return (
          <Space size="small">
            <Tooltip title={category === 'video' ? "Play Video" : category === 'audio' ? "Play Audio" : "Preview File"}>
              <Button 
                type="text" 
                className="action-btn preview-btn"
                icon={category === 'video' || category === 'audio' ? <PlayCircleOutlined /> : <EyeOutlined />} 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenPreview(record);
                }} 
              />
            </Tooltip>
            <Tooltip title="Download File">
              <Button 
                type="text" 
                className="action-btn download-btn"
                icon={<DownloadOutlined />} 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDownloadSecurely(record);
                }} 
              />
            </Tooltip>
            {canDelete && (
              <Tooltip title="Delete File">
                <Button 
                  type="text" 
                  danger 
                  className="action-btn delete-btn"
                  icon={<DeleteOutlined />} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(record);
                  }} 
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card bordered={false} className="attachments-card">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Upload Container */}
        {canEdit && (
          <div className="upload-container">
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={handleUpload}
              showUploadList={false}
              disabled={isUploading}
              className="attachments-dragger"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="upload-icon-anim" />
              </p>
              <p className="ant-upload-text font-weight-bold">
                Upload Videos, Audios, Images, or Documents
              </p>
              <p className="ant-upload-hint">
                Drag and drop media files here, or <span className="browse-link">click to browse files</span> (Max 100MB)
              </p>
            </Dragger>
            
            {isUploading && (
              <div className="upload-progress-overlay">
                <LoadingOutlined className="loading-spinner" />
                <Progress percent={uploadProgress} size="small" status="active" style={{ width: 220, marginTop: 8 }} />
                <div className="progress-text">Uploading to Server...</div>
              </div>
            )}
          </div>
        )}

        {/* Toolbar & View Mode Switcher */}
        {attachments.length > 0 && (
          <div className="attachments-toolbar">
            <div className="toolbar-left">
              <span className="attachments-counter">
                {attachments.length} {attachments.length === 1 ? 'Attachment' : 'Attachments'}
              </span>
              <Input
                placeholder="Search attachments..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                className="attachments-search-input"
              />
            </div>
            <div className="toolbar-right">
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { label: 'Table View', value: 'table', icon: <UnorderedListOutlined /> },
                  { label: 'Gallery Grid', value: 'grid', icon: <AppstoreOutlined /> },
                ]}
                className="view-mode-segmented"
              />
            </div>
          </div>
        )}

        {/* 1. TABLE VIEW */}
        {viewMode === 'table' && (
          <Table 
            columns={columns} 
            dataSource={filteredAttachments} 
            rowKey="id"
            loading={loading}
            locale={{ emptyText: 'No attachments found' }}
            pagination={attachments.length > 5 ? { pageSize: 6 } : false}
            className="attachments-table"
          />
        )}

        {/* 2. GALLERY / GRID VIEW */}
        {viewMode === 'grid' && (
          <div className="attachments-grid-container">
            {filteredAttachments.length === 0 ? (
              <Empty description="No attachments match your search" className="empty-attachments-grid" />
            ) : (
              <Row gutter={[16, 16]}>
                {filteredAttachments.map((item, idx) => {
                  const category = getAttachmentCategory(item.file_type, item.file_name);
                  const badge = getCategoryBadge(category);
                  const thumbUrl = thumbnailUrls[item.id];
                  const isTemporary = !associationId || associationId === 'null' || associationId === 'undefined';
                  const canDelete = canEdit && !item.isInherited && (
                    ['draft', 'pending_revision', 'temp'].includes(status) || 
                    isTemporary
                  );

                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={item.id || idx}>
                      <Card 
                        hoverable 
                        className="attachment-grid-card"
                        bodyStyle={{ padding: '12px 14px' }}
                      >
                        {/* Media Preview Box */}
                        <div 
                          className={`grid-card-media-box media-${category}`}
                          onClick={() => handleOpenPreview(item)}
                        >
                          {category === 'image' && thumbUrl ? (
                            <img 
                              src={thumbUrl} 
                              alt={item.file_name} 
                              className="grid-preview-img" 
                              onError={() => fetchThumbnailForAttachment(item)}
                            />
                          ) : category === 'video' ? (
                            <div className="grid-video-preview">
                              <div className="play-pulse-btn">
                                <PlayCircleOutlined />
                              </div>
                              <span className="media-type-pill">VIDEO</span>
                            </div>
                          ) : category === 'audio' ? (
                            <div className="grid-audio-preview">
                              <SoundOutlined className="grid-audio-icon" />
                              <span className="media-type-pill">AUDIO</span>
                            </div>
                          ) : (
                            <div className="grid-doc-preview">
                              {getFileIcon(item.file_type, item.file_name)}
                              <span className="media-type-pill">{category.toUpperCase()}</span>
                            </div>
                          )}

                          <div className="grid-media-hover-overlay">
                            <Button 
                              type="primary" 
                              shape="round" 
                              icon={category === 'video' || category === 'audio' ? <PlayCircleOutlined /> : <EyeOutlined />}
                            >
                              {category === 'video' ? 'Play' : category === 'audio' ? 'Listen' : 'Preview'}
                            </Button>
                          </div>
                        </div>

                        {/* Card Info */}
                        <div className="grid-card-info">
                          <Tooltip title={item.file_name}>
                            <div 
                              className="grid-card-title clickable-preview"
                              onClick={() => handleOpenPreview(item)}
                            >
                              {item.file_name}
                            </div>
                          </Tooltip>
                          
                          <div className="grid-card-meta">
                            <Tag color={badge.color} className="grid-badge">{badge.label}</Tag>
                            <span className="grid-size">{formatSize(item.file_size)}</span>
                          </div>

                          <div className="grid-card-uploader">
                            <span className="uploader-name">
                              {item.uploaded_by_name || 'System User'}
                            </span>
                            <span className="upload-time">
                              {moment(item.uploaded_at).format('MMM D, YYYY')}
                            </span>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="grid-card-actions">
                          <Button 
                            size="small" 
                            type="text" 
                            icon={<EyeOutlined />} 
                            onClick={() => handleOpenPreview(item)}
                          >
                            Preview
                          </Button>
                          <Button 
                            size="small" 
                            type="text" 
                            icon={<DownloadOutlined />} 
                            onClick={() => handleDownloadSecurely(item)}
                          >
                            Download
                          </Button>
                          {canDelete && (
                            <Button 
                              size="small" 
                              type="text" 
                              danger 
                              icon={<DeleteOutlined />} 
                              onClick={() => handleDelete(item)}
                            />
                          )}
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        )}
      </Space>

      {/* Dedicated In-App Attachment Preview Modal */}
      <AttachmentPreviewModal
        visible={previewVisible}
        attachment={selectedAttachment}
        cachedBlobUrl={selectedAttachment ? thumbnailUrls[selectedAttachment.id] : null}
        onClose={() => {
          setPreviewVisible(false);
          setSelectedAttachment(null);
        }}
        onDownload={handleDownloadSecurely}
      />
    </Card>
  );
};

export default AttachmentsTab;
