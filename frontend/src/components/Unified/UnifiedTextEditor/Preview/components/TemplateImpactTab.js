import React from 'react';
import { Card, Row, Col, Tag, Typography, Empty, Progress, Divider, Tabs } from 'antd';
import { RocketOutlined, ToolOutlined, TeamOutlined, DesktopOutlined } from '@ant-design/icons';
import ImpactFormEditor from '../../../../Home/components/Dashboard/Documents/ImpactFormEditor';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const TemplateImpactTab = ({ parsedTemplate, currentUser }) => {
  const impactData = parsedTemplate.impact_assessment || parsedTemplate.impactData || parsedTemplate.impact || {};
  const docId = parsedTemplate?.id || parsedTemplate?.document_id;
  const tplId = parsedTemplate?.template_id;

  const getEffortColor = (effort) => {
    switch (effort?.toLowerCase()) {
      case 'low': return 'green';
      case 'medium': return 'blue';
      case 'high': return 'orange';
      case 'critical': return 'red';
      default: return 'blue';
    }
  };

  const getEffortPercent = (effort) => {
    switch (effort?.toLowerCase()) {
      case 'low': return 25;
      case 'medium': return 50;
      case 'high': return 75;
      case 'critical': return 100;
      default: return 50;
    }
  };

  return (
    <Card bordered={false}>
      <Title level={5} style={{ marginBottom: 24 }}>Impact & Implementation Planning</Title>

      {/* ── NEW: Impact Form(s) ── */}
      {impactData.impactTemplates && impactData.impactTemplates.length > 0 ? (
        <Tabs defaultActiveKey="0" type="card" style={{ marginBottom: 24 }}>
          {impactData.impactTemplates.map((tpl, index) => (
            <TabPane tab={tpl.name} key={index.toString()}>
              <ImpactFormEditor
                templateHtml={tpl.content}
                filledValues={tpl.filledValues || []}
                dropdownValues={tpl.dropdownValues || []}
                readOnly={true}
                comments={tpl.comments || impactData.comments || []}
                documentId={docId}
                templateId={!docId ? tplId : null}
                currentUser={currentUser}
              />
            </TabPane>
          ))}
        </Tabs>
      ) : (impactData.impactTemplateContent || impactData.impactTemplateHtml) ? (
        <div style={{ marginBottom: 24 }}>
          <ImpactFormEditor
            templateHtml={impactData.impactTemplateContent || impactData.impactTemplateHtml}
            filledValues={impactData.impactFilledValues || []}
            dropdownValues={impactData.impactDropdownValues || []}
            readOnly={true}
            comments={impactData.comments || []}
            documentId={docId}
            templateId={!docId ? tplId : null}
            currentUser={currentUser}
          />
          <Divider />
        </div>
      ) : null}

      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card size="small" title={<span><TeamOutlined /> Impacted Departments</span>}>
            {impactData.departmentImpacts && impactData.departmentImpacts.length > 0 ? (
              <div style={{ padding: '8px 0' }}>
                {impactData.departmentImpacts.map(dept => (
                  <Tag key={dept} color="blue" style={{ marginBottom: 8 }}>{dept}</Tag>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No departments specified" />
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title={<span><DesktopOutlined /> Affected Systems</span>}>
            {impactData.affectedSystems && impactData.affectedSystems.length > 0 ? (
              <div style={{ padding: '8px 0' }}>
                {impactData.affectedSystems.map(system => (
                  <Tag key={system} color="cyan" style={{ marginBottom: 8 }}>{system}</Tag>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="None specified" />
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title={<span><ToolOutlined /> Implementation Effort</span>}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Progress
                type="dashboard"
                percent={getEffortPercent(impactData.implementationEffort)}
                strokeColor={getEffortColor(impactData.implementationEffort)}
                format={() => impactData.implementationEffort?.toUpperCase() || 'MEDIUM'}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Estimated organizational effort for rollout</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title={<span><RocketOutlined /> Training & Readiness</span>}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Training Required:</Text>
                <Tag
                  color={impactData.trainingRequired ? 'orange' : 'green'}
                  style={{ marginLeft: 8 }}
                >
                  {impactData.trainingRequired ? 'REQUIRED' : 'NOT REQUIRED'}
                </Tag>
              </div>
              <div>
                <Text strong>Implementation Notes:</Text>
                <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4, minHeight: 60 }}>
                  {impactData.impactNotes || impactData.notes || 'No specific implementation notes provided.'}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default TemplateImpactTab;
