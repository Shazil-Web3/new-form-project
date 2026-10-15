import React from 'react';
import { Card, Typography, Descriptions } from 'antd';
const { Text } = Typography;

const TemplateStructureTab = ({ parsedTemplate = {}, contentHtml = '', comments = [], suggestions = [], references = [] }) => {

  const renderLockedElements = () => {
    if (
      !parsedTemplate?.lockedElements || 
      Object.values(parsedTemplate.lockedElements).filter(isLocked => isLocked).length === 0
    ) {
      return <Text type="secondary">No elements locked</Text>;
    }

    return (
      <ul className="locked-elements-list">
        {Object.entries(parsedTemplate.lockedElements).map(([element, isLocked]) => (
          isLocked && <li key={element}>{element}</li>
        ))}
      </ul>
    );
  };

  return (
    <Card bordered={false}>
      <div className="template-structure">
        <Card title="Locked Elements" size="small" style={{ marginBottom: 16 }}>
          {renderLockedElements()}
        </Card>
        
        <Card title="Document Structure" size="small" style={{ marginBottom: 16 }}>
          <ul>
            {parsedTemplate?.includeTableOfContents && <li>Includes Table of Contents</li>}
            {parsedTemplate?.allowAttachments && <li>Allows File Attachments</li>}
            {!parsedTemplate?.includeTableOfContents && !parsedTemplate?.allowAttachments && 
              <Text type="secondary">No special structure settings</Text>}
          </ul>
        </Card>
        
        <Card title="Content Statistics" size="small" style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Word Count">
              {typeof contentHtml === 'string' ? contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length : 0}
            </Descriptions.Item>
            <Descriptions.Item label="Character Count">
              {typeof contentHtml === 'string' ? contentHtml.replace(/<[^>]*>/g, '').length : 0}
            </Descriptions.Item>
            <Descriptions.Item label="Comments">
              {(comments || []).length}
            </Descriptions.Item>
            <Descriptions.Item label="Suggestions">
              {(suggestions || []).length}
            </Descriptions.Item>
            <Descriptions.Item label="References">
              {(references || []).length}
            </Descriptions.Item>
            <Descriptions.Item label="Comment Replies">
              {(comments || []).reduce((total, comment) => total + (comment?.replies?.length || 0), 0)}
            </Descriptions.Item>
            <Descriptions.Item label="Suggestion Replies">
              {(suggestions || []).reduce((total, suggestion) => total + (suggestion?.replies?.length || 0), 0)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </Card>
  );
};

export default TemplateStructureTab;
