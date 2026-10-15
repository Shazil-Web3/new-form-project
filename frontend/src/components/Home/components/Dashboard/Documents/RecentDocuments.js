import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Typography,
  Space,
  Input
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Text } = Typography;

const Documents = ({ documents, navigate, handleCreateDocument, handlePreviewDocument, handleOpenDocumentPreviewModal }) => {
  const [searchText, setSearchText] = useState('');

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'in progress': return 'processing';
      case 'review': return 'warning';
      case 'planning': return 'cyan';
      default: return 'default';
    }
  };

  // Format and sort documents — use updated_at (real DB field) with fallback to last_modified (mock data)
  const documentsData = [...documents]
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.last_modified || 0);
      const dateB = new Date(b.updated_at || b.last_modified || 0);
      return dateB - dateA; // newest first
    })
    .map(doc => ({
      key: doc.document_id,
      title: doc.title,
      status: doc.status,
      lastModified: doc.updated_at || doc.last_modified || '—',
    }))
    .filter(doc =>
      !searchText || doc.title?.toLowerCase().includes(searchText.toLowerCase())
    );

  // Document columns for table
  const documentColumns = [
    {
      title: 'Document',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      key: 'lastModified',
      render: (val) => {
        if (!val || val === '—') return '—';
        const d = new Date(val);
        return isNaN(d) ? val : d.toLocaleString();
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            size="small" 
            onClick={() => handlePreviewDocument?.({
              document_id: record.key,
              title: record.title,
              status: record.status
            })}
          >
            Open
          </Button>
          <Button size="small">Share</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Recent Documents">
      {/* Search Bar */}
      <Input
        allowClear
        placeholder="Search documents by name..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 360 }}
      />

      <Table 
        columns={documentColumns} 
        dataSource={documentsData} 
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50']
        }}
        locale={{
          emptyText: searchText
            ? `No documents found matching "${searchText}"`
            : 'No documents found. Create one to get started!'
        }}
      />
    </Card>
  );
};

export default Documents;
