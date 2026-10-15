import React from 'react';
import {
  Row,
  Col,
  Card,
  List,
  Tag,
  Progress,
  Button,
  Typography,
  Badge,Statistic, Checkbox, Space
} from 'antd';
import {
  FolderOutlined,
  CheckSquareOutlined,
  FileOutlined,
  TeamOutlined,
  PlusOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

const Overview = ({ handleCreateDocument, showJoinDocModal, user, documents, tasks, activityLog, users, navigate, notifications }) => {
  // Helper functions
  const getStatusColor = (status) => {
    switch(status.toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'in progress': return 'processing';
      case 'review': return 'warning';
      case 'planning': return 'cyan';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'blue';
    }
  };

  // Filter tasks
  const highPriorityTasks = tasks.filter(task => task.priority === 'High' && !task.completed);
  const pendingTasks = tasks.filter(task => !task.completed);

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    try {
      const date = new Date(dateString);
      // Check if it's a valid date
      if (isNaN(date.getTime())) return dateString;
      
      // Format as YYYY-MM-DD or similar
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Task list item renderer
  const renderTaskItem = (item) => (
    <List.Item
      actions={[
        <Button type="link">Complete</Button>,
        <Button type="link">Edit</Button>
      ]}
    >
      <List.Item.Meta
        avatar={<Checkbox checked={item.completed} />}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text delete={item.completed}>{item.title}</Text>
            <Tag color={getPriorityColor(item.priority)}>{item.priority}</Tag>
          </div>
        }
        description={<Text type="secondary">Due: {formatDate(item.due_date || item.dueDate)}</Text>}
      />
    </List.Item>
  );

  return (
    <>
      <Row gutter={[16, 16]}>
        {user?.role !== 'member' && (
        <Col xs={24} sm={12} md={6}>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleCreateDocument}
                style={{ width: '100%' }}
              >
              New Document
              </Button>
              <Button 
                type="default" 
                icon={<FileTextOutlined />} 
                onClick={showJoinDocModal}
                style={{ width: '100%' }}
              >
              Join Document
              </Button>
            </Space>
          </div>
        </Col>
        )}
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending Tasks"
              value={pendingTasks.length}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Recent Documents"
              value={documents.length}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Team Members"
              value={users.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={16}>
          <Card title="Recent Documents" extra={<a href="#">View All</a>} style={{ marginTop: 16 }}>
            <List
              dataSource={documents.slice(0, 3)}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={() => navigate(`/document/${item.document_id}`)}
                    >
                      Open
                    </Button>,
                    <Button type="link" size="small">Share</Button>
                  ]}
                >
                  <List.Item.Meta
                    title={item.title}
                    description={<Tag color={getStatusColor(item.status)}>{item.status}</Tag>}
                  />
                  <Text type="secondary">Last modified: {item.last_modified}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="High Priority Tasks" extra={<Button type="link" size="small">Add Task</Button>}>
            <List
              dataSource={highPriorityTasks.slice(0, 5)}
              renderItem={renderTaskItem}
              locale={{ emptyText: 'No high priority tasks' }}
            />
          </Card>

          <Card title="Recent Activity" style={{ marginTop: 16 }}>
            <List
              dataSource={activityLog.slice(0, 5)}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text>{item.action}</Text>
                        <Text type="secondary">by {item.user}</Text>
                      </Space>
                    }
                    description={
                      <div>
                        <div>{item.item}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{item.time}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="Notifications" style={{ marginTop: 16 }}>
            <List
              dataSource={notifications.slice(0, 5)}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Badge status={item.read ? "default" : "processing"} />}
                    title={item.message}
                    description={item.time}
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No notifications' }}
            />
            {notifications.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Button type="link">Mark all as read</Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default Overview;