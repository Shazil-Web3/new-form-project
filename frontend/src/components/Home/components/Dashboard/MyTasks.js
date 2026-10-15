import React from 'react';
import { 
  Card, 
  Tabs, 
  List, 
  Button, 
  Tag, 
  Typography, 
  Checkbox,
  Space 
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Text } = Typography;

const MyTasks = ({ tasks, toggleTask, handleCreateTask }) => {
  // Filter tasks
  const pendingTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  // Helper function to get priority color
  const getPriorityColor = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'blue';
    }
  };

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
        <Button 
          type="link" 
          onClick={() => toggleTask(item.id, item.completed)}
        >
          {item.completed ? 'Reopen' : 'Complete'}
        </Button>,
        <Button type="link">Edit</Button>
      ]}
    >
      <List.Item.Meta
        avatar={
          <Checkbox 
            checked={item.completed} 
            onChange={() => toggleTask(item.id, item.completed)}
          />
        }
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text delete={item.completed}>{item.title}</Text>
            <Tag color={getPriorityColor(item.priority)}>{item.priority}</Tag>
          </div>
        }
        description={
          <div>
            <Text type="secondary">Due: {formatDate(item.due_date || item.dueDate)}</Text>
            {item.project && (
              <Tag style={{ marginLeft: 8 }}>{item.project}</Tag>
            )}
          </div>
        }
      />
    </List.Item>
  );

  return (
    <Card 
      title="My Tasks" 
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreateTask}
        >
          New Task
        </Button>
      }
    >
      <Tabs defaultActiveKey="pending">
        <TabPane tab={`Pending (${pendingTasks.length})`} key="pending">
          <List
            dataSource={pendingTasks}
            renderItem={renderTaskItem}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No pending tasks' }}
          />
        </TabPane>
        <TabPane tab={`Completed (${completedTasks.length})`} key="completed">
          <List
            dataSource={completedTasks}
            renderItem={renderTaskItem}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'No completed tasks' }}
          />
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default MyTasks;