import React from 'react';
import { Card, Button, Input, DatePicker, Row, Col, Typography, Alert, Tooltip } from 'antd';
import { PlusOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

export const DocumentTasksTab = ({
  tasks = [],
  addTask,
  updateTask,
  removeTask,
}) => {
  return (
    <Card
      bordered={false}
      title={
        <span>
          Document Tasks
          <Tooltip title="Define the tasks or sections that need to be completed for this document">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ marginBottom: 16 }}>
        {tasks.map((task, index) => (
          <div key={index} style={{ position: 'relative', marginBottom: 16, border: '1px solid #f0f0f0', padding: 16, borderRadius: 6 }}>
            <Row gutter={16}>
              <Col span={24}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Task {index + 1}</Text>
                  {tasks.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => removeTask(index)}
                      style={{ float: 'right' }}
                      size="small"
                    />
                  )}
                </div>
              </Col>
              <Col span={24}>
                <Input
                  placeholder="Enter task title"
                  value={task.title}
                  onChange={(e) => updateTask(index, 'title', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              </Col>
              <Col span={24}>
                <TextArea
                  rows={2}
                  placeholder="Enter task description"
                  value={task.description}
                  onChange={(e) => updateTask(index, 'description', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              </Col>
              <Col span={24}>
                <DatePicker
                  placeholder="Select due date (optional)"
                  style={{ width: '100%' }}
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  value={task.dueDate}
                  onChange={(date) => updateTask(index, 'dueDate', date)}
                />
              </Col>
            </Row>
          </div>
        ))}

        <Button
          type="dashed"
          onClick={addTask}
          block
          icon={<PlusOutlined />}
        >
          Add Task
        </Button>
      </div>

      <Alert
        message="Tasks are optional"
        type="info"
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};

export default DocumentTasksTab;
