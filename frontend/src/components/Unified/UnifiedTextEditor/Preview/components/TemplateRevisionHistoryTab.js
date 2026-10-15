import React, { useState, useEffect } from 'react';
import { Timeline, Button, Card, Tag, Typography, message, Spin, Empty } from 'antd';
import { RobotOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Text, Paragraph, Title } = Typography;

const TemplateRevisionHistoryTab = ({ templateId, currentVersion }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(null); // ID of the template being processed

  const fetchHistory = async () => {
    if (!templateId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await axios.get(`/api/templates/${templateId}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
      message.error('Failed to load revision history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (templateId) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [templateId]);

  const handleGenerateAI = async (id) => {
    try {
      setGeneratingAI(id);
      const response = await axios.post(`/api/templates/${id}/generate-ai-summary`);
      if (response.data.success) {
        message.success('AI summary generated successfully');
        // Update local state instead of refetching all
        setHistory(prev => prev.map(item => 
          item.id === id ? { ...item, ai_change_summary: response.data.summary } : item
        ));
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || 'Failed to generate AI summary';
      message.error(errorMsg);
    } finally {
      setGeneratingAI(null);
    }
  };

  if (!templateId) {
    return <Empty description="Select a template to view its history" />;
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin tip="Loading revision history..." />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return <Empty description="No revision history found" />;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: '24px' }}>Revision History</Title>
      
      <Timeline mode="left">
        {history.map((item, index) => {
          const isCurrent = String(item.id) === String(templateId);
          const hasAISummary = !!item.ai_change_summary;
          const canGenerateAI = item.version > 1 && !hasAISummary && (item.status === 'published' || item.status === 'revised' || item.status === 'archived');

          return (
            <Timeline.Item 
              key={item.id}
              dot={isCurrent ? <CheckCircleOutlined style={{ fontSize: '16px', color: '#52c41a' }} /> : <ClockCircleOutlined style={{ fontSize: '16px' }} />}
              color={isCurrent ? 'green' : 'blue'}
            >
              <Card 
                size="small" 
                style={{ 
                  marginBottom: '16px', 
                  borderLeft: isCurrent ? '4px solid #52c41a' : '1px solid #d9d9d9',
                  boxShadow: isCurrent ? '0 2px 8px rgba(0,0,0,0.09)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <Text strong style={{ fontSize: '16px' }}>Version {item.version}</Text>
                    {isCurrent && <Tag color="green" style={{ marginLeft: '8px' }}>Current</Tag>}
                    <Tag color={item.status === 'published' ? 'blue' : item.status === 'revised' ? 'orange' : 'default'} style={{ marginLeft: '4px' }}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Tag>
                  </div>
                  <Text type="secondary">{moment(item.updated_at).format('MMM D, YYYY h:mm A')}</Text>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <Text type="secondary">Publisher: </Text>
                  <Text>{item.first_name} {item.last_name}</Text>
                </div>

                {item.version === 1 ? (
                  <div style={{ padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <Text italic>Initial version of the template.</Text>
                  </div>
                ) : (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                      <RobotOutlined style={{ color: '#1890ff' }} />
                      <Text strong>AI Change Summary</Text>
                      {canGenerateAI && (
                        <Button 
                          type="link" 
                          size="small" 
                          onClick={() => handleGenerateAI(item.id)}
                          loading={generatingAI === item.id}
                          style={{ padding: 0, height: 'auto' }}
                        >
                          {generatingAI === item.id ? 'Generating...' : 'Get AI Summary'}
                        </Button>
                      )}
                    </div>

                    {hasAISummary ? (
                      <div style={{ 
                        padding: '12px', 
                        backgroundColor: '#e6f7ff', 
                        borderRadius: '4px',
                        border: '1px solid #91d5ff'
                      }}>
                        <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                          {item.ai_change_summary}
                        </Paragraph>
                      </div>
                    ) : (
                      <div style={{ padding: '8px', backgroundColor: '#fafafa', borderRadius: '4px', border: '1px dashed #d9d9d9' }}>
                        <Text type="secondary" italic>
                          {(item.status === 'published' || item.status === 'revised' || item.status === 'archived')
                            ? "No summary generated yet. Click 'Get AI Summary' to analyze changes." 
                            : "Summary will be available once this version is published."}
                        </Text>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </Timeline.Item>
          );
        })}
      </Timeline>
    </div>
  );
};

export default TemplateRevisionHistoryTab;
