import React from 'react';
import { Card, Row, Col, Form, Switch, Checkbox, Typography, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const StructureSettings = ({ lockedElements, handleLockElementToggle }) => {
  return (
    <Card 
    bordered={false} 
    bodyStyle={{padding: '16px'}}
    title=
      <span>
        Template Structure and Locked Elements 
          <Tooltip 
            title="Define which elements of the template should be locked and cannot be modified by users."
            >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >      
      <Row gutter={[12, 12]}>
        <Col span={12}>
          <Card size="small" title="Content Locking">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Form.Item name="lockContent" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.content}
                    onChange={() => handleLockElementToggle('content')}
                  />
                </Form.Item>
                <Text> Lock Contents</Text>
              </div>
              <div>
                <Form.Item name="lockTOC" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.toc}
                    onChange={() => handleLockElementToggle('toc')}
                  />
                </Form.Item>
                <Text> Lock Table of Contents</Text>
              </div>
              <div>
                <Form.Item name="lockFontSize" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.fontSize}
                    onChange={() => handleLockElementToggle('fontSize')}
                  />
                </Form.Item>
                <Text> Lock Font Size</Text>
              </div>
              <div>
                <Form.Item name="lockFontStyle" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.fontStyle}
                    onChange={() => handleLockElementToggle('fontStyle')}
                  />
                </Form.Item>
                <Text> Lock Font Style</Text>
              </div>
              <div>
                <Form.Item name="lockHeaderFooter" valuePropName="checked" noStyle>
                  <Switch 
                    checked={lockedElements.headerFooter}
                    onChange={() => handleLockElementToggle('headerFooter')}
                  />
                </Form.Item>
                <Text> Lock Header/Footer</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="Table of Contents">
            <Form.Item
              name="includeTableOfContents"
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>Include Table of Contents (Index)</Checkbox>
            </Form.Item>
            <Text type="secondary">
              A table of contents will be automatically generated based on the document structure.
            </Text>
          </Card>
          
          <Card size="small" title="Attachments" style={{ marginTop: '12px' }}>
            <Form.Item
              name="allowAttachments"
              valuePropName="checked"
              initialValue={false}
            >
              <Checkbox>Allow File Attachments</Checkbox>
            </Form.Item>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default StructureSettings;
