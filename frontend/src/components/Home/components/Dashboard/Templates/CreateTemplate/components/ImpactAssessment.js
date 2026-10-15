import React from 'react';
import { Card, Form, Select, Switch, Input, Tooltip, Divider, Tabs } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import ImpactFormEditor from '../../../Documents/ImpactFormEditor';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

/**
 * ImpactAssessment
 *
 * Existing props (unchanged):
 *   impactData      {object}  The impact state object.
 *   setImpactData   {fn}      Setter for impactData.
 *   departments     {array}   Available departments list.
 *
 * New props (optional — no-op if omitted):
 *   impactTemplates       {array}         List of impact templates { id, name, content, filledValues }.
 *   onImpactTemplatesChange {fn}          Called with updated impactTemplates array.
 *   impactTemplateHtml    {string|null}   HTML content of the selected impact template.
 *   impactFilledValues    {string[]}      Saved blank-fill values.
 *   onFilledValuesChange  {fn}            Called with updated filledValues array.
 *   readOnly              {boolean}       Pass true to disable the form editor.
 */
const ImpactAssessment = ({
  impactData,
  setImpactData,
  departments,
  // New optional props for multiple templates
  impactTemplates = [],
  onImpactTemplatesChange,
  // New optional props (legacy single-template support)
  impactTemplateHtml,
  impactFilledValues,
  onFilledValuesChange,
  readOnly = false,
  documentId = null,
  currentUser = null,
}) => {
  const handleFieldValuesChange = (index, newFilledValues, newDropdownValues) => {
    if (onImpactTemplatesChange) {
      const updated = [...impactTemplates];
      updated[index] = {
        ...updated[index],
        filledValues: newFilledValues,
        dropdownValues: newDropdownValues,
      };
      onImpactTemplatesChange(updated);
    } else if (onFilledValuesChange) {
      onFilledValuesChange(newFilledValues);
    }
  };

  const handleCommentsChange = (index, nextComments) => {
    let updatedTemplates = null;
    if (onImpactTemplatesChange && impactTemplates.length > 0) {
      updatedTemplates = [...impactTemplates];
      updatedTemplates[index] = {
        ...updatedTemplates[index],
        comments: nextComments,
      };
      onImpactTemplatesChange(updatedTemplates);
    }
    if (setImpactData) {
      setImpactData((prev) => ({
        ...prev,
        comments: nextComments,
        ...(updatedTemplates ? { impactTemplates: updatedTemplates } : {}),
      }));
    }
  };

  return (
    <>
      {/* ── Impact Form(s) ── */}
      {impactTemplates && impactTemplates.length > 0 ? (
        <Tabs defaultActiveKey="0" type="card" destroyInactiveTabPane={false} style={{ marginBottom: 20 }}>
          {impactTemplates.map((tpl, index) => (
            <TabPane tab={tpl.name} key={index.toString()}>
              <ImpactFormEditor
                templateHtml={tpl.content}
                filledValues={tpl.filledValues || []}
                dropdownValues={tpl.dropdownValues || []}
                onChange={(filled, dropdown) => handleFieldValuesChange(index, filled, dropdown)}
                readOnly={readOnly}
                comments={tpl.comments || impactData?.comments || []}
                onCommentsChange={(nextComments) => handleCommentsChange(index, nextComments)}
                documentId={documentId}
                currentUser={currentUser}
              />
            </TabPane>
          ))}
        </Tabs>
      ) : impactTemplateHtml ? (
        <>
          <ImpactFormEditor
            templateHtml={impactTemplateHtml}
            filledValues={impactFilledValues || []}
            onChange={(filled) => onFilledValuesChange && onFilledValuesChange(filled)}
            readOnly={readOnly}
            comments={impactData?.comments || []}
            onCommentsChange={(nextComments) => handleCommentsChange(0, nextComments)}
            documentId={documentId}
            currentUser={currentUser}
          />
          <Divider style={{ margin: '4px 0 16px' }} />
        </>
      ) : null}

      {/* ── EXISTING: Department Impact Assessment card (unchanged) ── */}
      <Card
        bordered={false}
        bodyStyle={{ padding: '16px' }}
        title={
          <span>
            Department Impact Assessment
            <Tooltip title="Assess how this template will impact different departments and systems within the organization.">
              <InfoCircleOutlined style={{ marginLeft: 8 }} />
            </Tooltip>
          </span>
        }
      >
        <Form.Item
          name="departmentImpacts"
          label="Impacted Departments"
        >
          <Select
            mode="multiple"
            placeholder="Select departments impacted by this template"
            value={impactData.departmentImpacts}
            onChange={(values) => setImpactData({ ...impactData, departmentImpacts: values })}
            style={{ width: '100%' }}
            disabled={readOnly}
          >
            {departments.map(dept => (
              <Option key={dept.id} value={dept.name}>{dept.name}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="affectedSystems"
          label="Affected Systems/Processes"
        >
          <Select
            mode="tags"
            placeholder="Select or add affected systems or processes"
            value={impactData.affectedSystems}
            onChange={(values) => setImpactData({ ...impactData, affectedSystems: values })}
            style={{ width: '100%' }}
            disabled={readOnly}
          >
            <Option value="accounting">Accounting System</Option>
            <Option value="crm">CRM</Option>
            <Option value="hr">HR Management</Option>
            <Option value="procurement">Procurement</Option>
            <Option value="reporting">Reporting</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="implementationEffort"
          label="Implementation Effort"
        >
          <Select
            placeholder="Select implementation effort level"
            value={impactData.implementationEffort}
            onChange={(value) => setImpactData({ ...impactData, implementationEffort: value })}
            style={{ width: '100%' }}
            disabled={readOnly}
          >
            <Option value="low">Low - Minimal changes required</Option>
            <Option value="medium">Medium - Moderate process adjustments needed</Option>
            <Option value="high">High - Significant process changes</Option>
            <Option value="veryHigh">Very High - Complete process redesign</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="trainingRequired"
          label="Training Required"
          valuePropName="checked"
        >
          <Switch
            checked={impactData.trainingRequired}
            onChange={(checked) => setImpactData({ ...impactData, trainingRequired: checked })}
            disabled={readOnly}
          />
          {' '}User training will be required for this template
        </Form.Item>

        <Form.Item
          name="impactNotes"
          label="Additional Impact Notes"
        >
          <TextArea
            rows={4}
            placeholder="Additional notes about department impact or implementation considerations"
            value={impactData.impactNotes}
            onChange={(e) => setImpactData({ ...impactData, impactNotes: e.target.value })}
            disabled={readOnly}
          />
        </Form.Item>
      </Card>
    </>
  );
};

export default ImpactAssessment;
