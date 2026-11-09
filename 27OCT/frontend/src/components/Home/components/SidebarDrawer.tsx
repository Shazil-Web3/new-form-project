import React, { useState } from 'react';
import { Button, Input, Tag, Empty, Tooltip } from 'antd';
import {
  CloseOutlined,
  SearchOutlined,
  FileTextOutlined,
  StarOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  PlusOutlined,
  RightOutlined
} from '@ant-design/icons';
import './Sidebar.css';

const { Search } = Input;

const SidebarDrawer = ({
  visible,
  onClose,
  drawerType = 'templates',
  sidebarWidth = 250,
  templates = [],
  onSelectTemplate,
  handleCreateDocument,
  user
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  if (!visible) return null;

  // Filter templates based on search & category
  const filteredTemplates = (templates || []).filter(template => {
    const matchesSearch = (template.title || template.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (template.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set((templates || []).map(t => t.category).filter(Boolean)))];

  const renderContent = () => {
    if (drawerType === 'templates') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <Search
              placeholder="Search screen templates..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
            />
            {categories.length > 1 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {categories.map(cat => (
                  <Tag
                    key={cat}
                    color={selectedCategory === cat ? 'blue' : 'default'}
                    style={{ cursor: 'pointer', borderRadius: 12, textTransform: 'capitalize' }}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Tag>
                ))}
              </div>
            )}
          </div>

          <div className="sidebar-drawer-body">
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map(template => (
                <div
                  key={template.id || template._id}
                  className="template-drawer-card"
                  onClick={() => {
                    if (onSelectTemplate) onSelectTemplate(template);
                    onClose();
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="template-drawer-badge">{template.category || 'General Template'}</span>
                    <RightOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937', marginBottom: 4 }}>
                    {template.title || template.name || 'Untitled Template'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {template.description || 'No description provided for this template.'}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                    <span>v{template.version || '1.0'}</span>
                    <span>{template.updated_at ? new Date(template.updated_at).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No screen templates found"
              >
                {handleCreateDocument && (
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateDocument}>
                    Create Template
                  </Button>
                )}
              </Empty>
            )}
          </div>
        </>
      );
    }

    if (drawerType === 'quick-access') {
      return (
        <div className="sidebar-drawer-body">
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#374151' }}>Quick Shortcuts</div>
          <div
            className="template-drawer-card"
            onClick={() => {
              if (handleCreateDocument) handleCreateDocument();
              onClose();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PlusOutlined style={{ color: '#1890ff', fontSize: 16 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Create New Screen Document</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Start with a blank document or template</div>
              </div>
            </div>
          </div>

          <div className="template-drawer-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StarOutlined style={{ color: '#faad14', fontSize: 16 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Starred Templates</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>View your favorite screen layouts</div>
              </div>
            </div>
          </div>

          <div className="template-drawer-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HistoryOutlined style={{ color: '#52c41a', fontSize: 16 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Recent Activity</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Screens edited recently by your team</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="sidebar-drawer-overlay" onClick={onClose} />
      <div
        className={`sidebar-drawer-panel ${visible ? 'open' : 'closed'}`}
        style={{ left: `${sidebarWidth}px` }}
      >
        <div className="sidebar-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {drawerType === 'templates' ? <AppstoreOutlined style={{ color: '#1890ff', fontSize: 18 }} /> : <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />}
            <h3 className="sidebar-drawer-title">
              {drawerType === 'templates' ? 'Screen Templates Drawer' : 'Quick Access Drawer'}
            </h3>
          </div>
          <Tooltip title="Close Drawer">
            <Button
              type="text"
              shape="circle"
              icon={<CloseOutlined />}
              onClick={onClose}
            />
          </Tooltip>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default SidebarDrawer;
