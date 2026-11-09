import React from 'react';
import { Card, Select, Button, Row, Col, Typography, Tag, Divider, Alert, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { roleColors } from '../helpers/createDocumentHelpers';

const { Option } = Select;
const { Text } = Typography;

export const DocumentParticipantsTab = ({
  user,
  users = [],
  selectableUsers = [],
  participants = [],
  addParticipant,
  updateParticipantRole,
  removeParticipant,
}) => {
  return (
    <Card
      bordered={false}
      title={
        <span>
          Document Access & Participants
          <Tooltip title="Manage who can access this document and their permission levels">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <p><strong>Creator:</strong></p>
        <Tag color={roleColors.author}>
          {user.email} (Author)
        </Tag>
      </div>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Text strong>Add Team Members</Text>
        <Select
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Select team members by email"
          value={null}
          onChange={addParticipant}
          optionLabelProp="label"
        >
          {selectableUsers
            .filter(u => !participants.some(p => p.userId === u.id))
            .map(u => (
              <Option
                key={u.id}
                value={u.id}
                label={u.email}
              >
                <div>
                  <div>{u.email}</div>
                  {u.first_name && u.last_name && <div style={{ fontSize: 'smaller', color: '#666' }}>{u.first_name} {u.last_name}</div>}
                </div>
              </Option>
            ))
          }
        </Select>
      </div>

      {participants.length > 0 && (
        <div>
          <Text strong>Selected Participants</Text>
          <div style={{ marginTop: 8 }}>
            {participants.map(participant => {
              const participantUser = users.find(u => u.id === participant.userId);
              return (
                <Row
                  key={participant.userId}
                  gutter={16}
                  align="middle"
                  style={{ marginBottom: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}
                >
                  <Col flex="auto">
                    <Tag>{participantUser?.email}</Tag>
                  </Col>
                  <Col>
                    <Select
                      value={participant.role}
                      onChange={(role) => updateParticipantRole(participant.userId, role)}
                      style={{ width: 120 }}
                    >
                      <Option value="editor">Editor</Option>
                      <Option value="commenter">Commenter</Option>
                      <Option value="viewer">Viewer</Option>
                    </Select>
                  </Col>
                  <Col>
                    <Button
                      type="text"
                      danger
                      onClick={() => removeParticipant(participant.userId)}
                      size="small"
                    >
                      Remove
                    </Button>
                  </Col>
                </Row>
              );
            })}
          </div>
        </div>
      )}

      <Alert
        message="Participants are optional. You can add team members later if needed."
        type="info"
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};

export default DocumentParticipantsTab;
