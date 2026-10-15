import React from 'react';
import { Card, Typography, Empty, Avatar } from 'antd';
import { UserOutlined, BulbOutlined, BookOutlined } from '@ant-design/icons';

const TemplateActivityTab = ({ comments = [], suggestions = [], references = [] }) => {
  return (
    <Card bordered={false}>
      <Typography.Title level={5}>Recent Activity</Typography.Title>

      {comments.length === 0 && suggestions.length === 0 && references.length === 0 ? (
        <Empty
          description="No activity yet"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div className="activity-timeline">
          {[
            // Comments and their replies
            ...comments.flatMap(comment => [
              {
                type: 'comment',
                timestamp: comment.timestamp,
                user: comment.user,
                text: comment.text,
                highlightedText: comment.highlightedText
              },
              ...(comment.replies || []).map(reply => ({
                type: 'reply',
                timestamp: reply.timestamp,
                user: reply.user,
                text: reply.text,
                parentComment: comment.text.substring(0, 50) + '...'
              }))
            ]),
            // Suggestions and their replies
            ...suggestions.flatMap(suggestion => [
              {
                type: 'suggestion',
                timestamp: suggestion.timestamp,
                user: suggestion.user,
                text: suggestion.text,
                highlightedText: suggestion.highlightedText
              },
              ...(suggestion.replies || []).map(reply => ({
                type: 'suggestion-reply',
                timestamp: reply.timestamp,
                user: reply.user,
                text: reply.text,
                parentSuggestion: suggestion.text.substring(0, 50) + '...'
              }))
            ]),
            // References
            ...references.map(reference => ({
              type: 'reference',
              timestamp: reference.timestamp || new Date().toISOString(),
              user: reference.user || 'System',
              text: reference.refContent || 'Reference created',
              highlightedText: reference.refText,
              refNumber: reference.refNumber
            }))
          ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map((activity, index) => (
              <Card key={index} size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Avatar
                    size="small"
                    icon={activity.type === 'reference' ? <BookOutlined /> : <UserOutlined />}
                    style={{ marginRight: 8, flexShrink: 0, backgroundColor: activity.type === 'reference' ? '#1890ff' : undefined }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <Typography.Text strong>{activity.user}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                        {activity.type === 'reply' ? 'replied to comment' :
                          activity.type === 'suggestion-reply' ? 'replied to suggestion' :
                            activity.type === 'suggestion' ? 'suggested' :
                              activity.type === 'reference' ? (activity.refNumber ? `added reference [${activity.refNumber}]` : 'added manual reference') : 'commented'}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: '11px', marginLeft: 8 }}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </Typography.Text>
                    </div>

                    <Typography.Text style={{ fontSize: '13px' }}>
                      {activity.text}
                    </Typography.Text>

                    {(activity.type === 'comment' || activity.type === 'suggestion') && activity.highlightedText && (
                      <blockquote style={{
                        margin: '4px 0 0 0',
                        paddingLeft: '8px',
                        borderLeft: activity.type === 'suggestion' ? '2px solid #faad14' : '2px solid #d9d9d9',
                        color: '#666',
                        fontSize: '11px',
                        backgroundColor: activity.type === 'suggestion' ? 'rgba(250, 173, 20, 0.1)' : 'transparent'
                      }}>
                        {activity.type === 'suggestion' && <BulbOutlined style={{ marginRight: 4, color: '#faad14' }} />}
                        "{activity.highlightedText}"
                      </blockquote>
                    )}

                    {activity.type === 'reply' && (
                      <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                        Reply to: {activity.parentComment}
                      </Typography.Text>
                    )}

                    {activity.type === 'suggestion-reply' && (
                      <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                        Reply to suggestion: {activity.parentSuggestion}
                      </Typography.Text>
                    )}
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}
    </Card>
  );
};

export default TemplateActivityTab;
