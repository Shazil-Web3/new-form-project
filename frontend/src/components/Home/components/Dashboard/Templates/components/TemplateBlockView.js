import React from 'react';
import { 
  List, 
  Tag, 
  Typography, 
  Empty
} from 'antd';
import TemplateCardItem from './TemplateCardItem';
import { formatTemplateData, getStatusDisplay } from '../utils/templateListUtils';

const { Title } = Typography;

export const TemplateBlockView = ({
  activeTab,
  publicTemplates,
  orgTemplates,
  orgCategories,
  getTemplateBlockActions,
  handleUseTemplateWithCheck
}) => {
  const renderItem = (template) => {
    const formattedTemplate = formatTemplateData(template, orgCategories);
    const isPublicTemplate = !template.organization_id;
    const statusDisplay = getStatusDisplay(formattedTemplate.status);

    return (
      <TemplateCardItem
        key={template.id}
        template={template}
        formattedTemplate={formattedTemplate}
        statusDisplay={statusDisplay}
        isPublicTemplate={isPublicTemplate}
        activeTab={activeTab}
        orgCategories={orgCategories}
        getTemplateBlockActions={getTemplateBlockActions}
        handleUseTemplateWithCheck={handleUseTemplateWithCheck}
      />
    );
  };

  if (activeTab === "1") {
    // Public templates - simple list
    return (
      <List
        grid={{ 
          gutter: [16, 16], 
          xs: 1, 
          sm: 2, 
          md: 3, 
          lg: 3, 
          xl: 4, 
          xxl: 5 
        }}
        dataSource={publicTemplates}
        renderItem={renderItem}
        locale={{ emptyText: <Empty description="No templates found" /> }}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} templates`
        }}
      />
    );
  }

  // Organization templates - show both published and disabled templates
  const publishedTemplates = orgTemplates.filter(t => t.status === 'published');
  const disabledTemplates = orgTemplates.filter(t => t.status === 'disabled');
  const pendingRevisionTemplates = orgTemplates.filter(t => t.status === 'pending_revision');
  const allAvailableTemplates = [...publishedTemplates, ...disabledTemplates, ...pendingRevisionTemplates]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  return (
    <div>
      {/* All Templates Section */}
      {allAvailableTemplates.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4}>Organization Templates</Title>
            <div>
              <Tag color="success">Published: {publishedTemplates.length}</Tag>
              <Tag color="warning">Revision: {pendingRevisionTemplates.length}</Tag>
              <Tag color="error">Disabled: {disabledTemplates.length}</Tag>
            </div>
          </div>
          <List
            grid={{ 
              gutter: [16, 16], 
              xs: 1, 
              sm: 2, 
              md: 3, 
              lg: 3, 
              xl: 4, 
              xxl: 5 
            }}
            dataSource={allAvailableTemplates}
            renderItem={renderItem}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} templates`
            }}
          />
        </div>
      )}
      
      {/* Empty state */}
      {allAvailableTemplates.length === 0 && (
        <Empty description="No templates available" />
      )}
    </div>
  );
};

export default TemplateBlockView;
