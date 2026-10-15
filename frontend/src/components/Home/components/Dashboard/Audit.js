import React from 'react';
import { Card, Table, Tag, Typography, Space, Button } from 'antd';
import { AuditOutlined, SearchOutlined } from '@ant-design/icons';

const { Text } = Typography;

const Audit = ({ activityLog }) => {
  // Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get color based on action type
  const getActionColor = (action) => {
    const actionType = action.toLowerCase();
    if (actionType.includes('create')) return 'green';
    if (actionType.includes('delete')) return 'red';
    if (actionType.includes('update')) return 'blue';
    if (actionType.includes('login')) return 'cyan';
    if (actionType.includes('logout')) return 'purple';
    return 'default';
  };

  // Columns configuration for the audit table
  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'time',
      key: 'time',
      sorter: (a, b) => new Date(a.time) - new Date(b.time),
      render: (time) => formatTimestamp(time),
      width: '20%',
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      render: (user) => <Text strong>{user}</Text>,
      width: '15%',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action) => (
        <Tag color={getActionColor(action)}>
          {action}
        </Tag>
      ),
      width: '20%',
    },
    {
      title: 'Item',
      dataIndex: 'item',
      key: 'item',
      render: (item) => <Text type="secondary">{item}</Text>,
      width: '25%',
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            size="small" 
            icon={<SearchOutlined />}
            onClick={() => console.log('View details:', record)}
          >
            Details
          </Button>
        </Space>
      ),
      width: '20%',
    },
  ];

  // Format activity log data for table
  const auditData = activityLog.map((log, index) => ({
    key: index,
    time: log.time,
    user: log.user,
    action: log.action,
    item: log.item,
    details: log.details || 'No additional details',
  }));

  return (
    <Card 
      title={
        <Space>
          <AuditOutlined />
          <span>Audit Trail</span>
        </Space>
      }
      bordered={false}
      extra={
        <Button 
          type="primary" 
          icon={<SearchOutlined />}
          onClick={() => console.log('Filter clicked')}
        >
          Filter
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={auditData}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['15', '30', '50', '100'],
          showTotal: (total) => `Total ${total} audit entries`,
        }}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: 'No audit records available',
        }}
      />
    </Card>
  );
};

export default Audit;