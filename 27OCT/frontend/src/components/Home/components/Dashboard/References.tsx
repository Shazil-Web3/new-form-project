import React from 'react';
import { Card, Tabs, Table, Button, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Text } = Typography;

const References = ({ onAddReference }) => {
  // Table columns configuration
  const referenceColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <a>{text}</a>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Added By',
      dataIndex: 'addedBy',
      key: 'addedBy',
    },
    {
      title: 'Date Added',
      dataIndex: 'dateAdded',
      key: 'dateAdded',
    },
    {
      title: 'Actions',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small">View</Button>
          <Button size="small">Add to Document</Button>
        </Space>
      ),
    },
  ];

  // Sample data - replace with actual data from props/API
  const referencesData = [
    { key: '1', title: 'Style Guide 2025', type: 'PDF', addedBy: 'John Smith', dateAdded: '2025-02-15' },
    { key: '2', title: 'Brand Assets', type: 'Folder', addedBy: 'You', dateAdded: '2025-03-10' },
    { key: '3', title: 'Compliance Regulations', type: 'Document', addedBy: 'Sarah Johnson', dateAdded: '2025-03-20' },
  ];

  return (
    <Card 
      title="References Library"
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={onAddReference}
        >
          Add Reference
        </Button>
      }
    >
      <Tabs defaultActiveKey="all">
        <TabPane tab="All References" key="all">
          <Table
            columns={referenceColumns}
            dataSource={referencesData}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Text type="secondary">
                  No references found. Click "Add Reference" to create one.
                </Text>
              )
            }}
          />
        </TabPane>
        
        <TabPane tab="My References" key="my">
          <Table
            columns={referenceColumns}
            dataSource={referencesData.filter(ref => ref.addedBy === 'You')}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Text type="secondary">
                  You haven't added any references yet.
                </Text>
              )
            }}
          />
        </TabPane>
        
        <TabPane tab="Templates" key="templates">
          <Table
            columns={referenceColumns}
            dataSource={referencesData.filter(ref => ref.type === 'Template')}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Text type="secondary">
                  No templates available. Contact your admin to add templates.
                </Text>
              )
            }}
          />
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default References;