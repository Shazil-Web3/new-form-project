import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Input, Spin, message, Divider, List, Tag, Avatar, Space, Button, Tooltip, Empty } from 'antd';
import { UserOutlined, ClockCircleOutlined, SendOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const getAuthToken = () => {
  try {
    const keys = ['accessToken', 'access_token', 'token', 'jwt', 'authToken', 'authorization'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }

    const authTokens = localStorage.getItem('auth_tokens');
    if (authTokens) {
      try {
        const parsed = JSON.parse(authTokens);
        if (parsed.accessToken) return parsed.accessToken;
        if (parsed.access_token) return parsed.access_token;
      } catch (e) {
        console.warn('Error parsing auth_tokens:', e);
      }
    }

    const cookieMatch = document.cookie.match(/(?:^|; )(?:(?:accessToken|access_token|token|jwt)=)([^;]+)/);
    if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
  } catch (e) {
    console.warn(e);
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

// Helper to safely parse notes data (handles structured JSON array of note entries OR legacy raw text string)
const parseNotesData = (rawNotes) => {
  if (!rawNotes) return [];
  if (Array.isArray(rawNotes)) return rawNotes;
  if (typeof rawNotes === 'object') return [rawNotes];
  
  if (typeof rawNotes === 'string') {
    const trimmed = rawNotes.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return [parsed];
      } catch (e) {
        // Fallback to legacy string format below
      }
    }
    // Legacy plain string format
    if (trimmed) {
      return [{
        id: 'legacy-1',
        text: trimmed,
        user: { name: 'Author / Editor', email: '' },
        timestamp: new Date().toISOString()
      }];
    }
  }
  return [];
};

const TemplateNotesTab = ({ parsedTemplate, associationType = 'template', currentUser, onNotesChange }) => {
  const [notesList, setNotesList] = useState(() => parseNotesData(parsedTemplate?.notes));
  const [currentInput, setCurrentInput] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  
  const onNotesChangeRef = useRef(onNotesChange);
  useEffect(() => {
    onNotesChangeRef.current = onNotesChange;
  }, [onNotesChange]);

  // Derive active logged-in user details
  const activeUser = currentUser || (() => {
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  })() || {
    first_name: 'Current',
    last_name: 'User',
    email: 'user@organization.com'
  };

  const userEmail = activeUser.email || '';
  const userRole = activeUser.role || 'Member';

  // Strictly check if the active user has administrator privileges
  const isAdmin = Boolean(
    activeUser && (
      String(activeUser.role || '').toLowerCase() === 'admin' ||
      String(activeUser.role || '').toLowerCase() === 'superadmin' ||
      activeUser.is_admin === true ||
      activeUser.isAdmin === true ||
      activeUser.role === 1 ||
      activeUser.role === '1'
    )
  );

  // Keep local notes in sync when parsedTemplate.notes changes externally
  useEffect(() => {
    const externalParsed = parseNotesData(parsedTemplate?.notes);
    setNotesList(externalParsed);
  }, [parsedTemplate?.notes]);

  // Debounced API save function for persisting the full structured notes JSON array or string
  const saveNotesPayload = async (newList) => {
    const payloadString = JSON.stringify(newList);
    if (onNotesChangeRef.current) {
      onNotesChangeRef.current(payloadString);
    }

    const id = parsedTemplate?.id || parsedTemplate?.template_id || parsedTemplate?.document_id;
    if (!id) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    const headers = getAuthHeaders();

    try {
      if (associationType === 'template') {
        await axios.put(
          `/api/update_template_metadata/${id}`,
          { notes: payloadString },
          { headers }
        );
      } else {
        await axios.put(
          `/api/update_document/${id}`,
          { notes: payloadString },
          { headers }
        );
      }
      setSaveStatus('saved');
    } catch (error) {
      console.warn('Metadata update failed, attempting REST notes fallback:', error);
      try {
        const endpoint = associationType === 'template' ? `/api/templates/${id}/notes` : `/api/documents/${id}/notes`;
        await axios.post(endpoint, { content: payloadString }, { headers });
        setSaveStatus('saved');
      } catch (err2) {
        console.error('Error saving notes:', error, err2);
        setSaveStatus('error');
      }
    }
  };

  const handleAddNote = () => {
    if (!currentInput.trim()) return;

    const displayName = (activeUser.first_name ? `${activeUser.first_name} ${activeUser.last_name || ''}`.trim() : activeUser.name) || userEmail || 'User';

    const newNoteEntry = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: currentInput.trim(),
      user: {
        id: activeUser.id || activeUser.userId,
        name: displayName,
        email: userEmail,
        role: userRole
      },
      timestamp: new Date().toISOString()
    };

    const updatedList = [newNoteEntry, ...notesList];
    setNotesList(updatedList);
    setCurrentInput('');
    saveNotesPayload(updatedList);
    message.success('Note added successfully');
  };

  const handleDeleteNote = (noteId) => {
    const noteToDelete = notesList.find(n => n.id === noteId);
    const isNoteAuthor = noteToDelete && (
      (noteToDelete.user?.id && (String(noteToDelete.user.id) === String(activeUser.id || activeUser.userId))) ||
      (noteToDelete.user?.email && String(noteToDelete.user.email).toLowerCase() === String(userEmail).toLowerCase())
    );

    if (!isAdmin && !isNoteAuthor) {
      message.error('Only administrators or the author of this note can delete it.');
      return;
    }
    const updatedList = notesList.filter(n => n.id !== noteId);
    setNotesList(updatedList);
    saveNotesPayload(updatedList);
    message.info('Note removed');
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return <span style={{ color: '#1890ff', fontSize: '12px' }}><Spin size="small" style={{ marginRight: 6 }} />Saving...</span>;
      case 'error':
        return <span style={{ color: '#f5222d', fontSize: '12px' }}>Error saving changes</span>;
      case 'saved':
      default:
        return <span style={{ color: '#52c41a', fontSize: '12px' }}>✓ Saved</span>;
    }
  };

  return (
    <Card bordered={false} style={{ background: '#fafafa', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {associationType === 'template' ? 'Template Notes & Audit Remarks' : 'Document Notes & Audit Remarks'}
        </Typography.Title>
        {getStatusText()}
      </div>

      {/* Input section with active user identity header badge */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: 20, 
          borderColor: '#1890ff', 
          borderRadius: 8, 
          boxShadow: '0 2px 8px rgba(24, 144, 255, 0.08)' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Avatar size="small" style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
            <span style={{ fontWeight: 600, fontSize: 13, color: '#000000' }}>{userEmail || 'Active User'}</span>
          </Space>
          <Tag color="blue" style={{ margin: 0, textTransform: 'capitalize' }}>
            {userRole}
          </Tag>
        </div>

        <Input.TextArea
          rows={3}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          placeholder={`Type a note or remark as ${userEmail || 'User'}...`}
          style={{ borderRadius: 6, marginBottom: 8, color: '#000000' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleAddNote();
            }
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#000000', fontWeight: 500 }}>
            <InfoCircleOutlined style={{ marginRight: 4, color: '#000000' }} />
            Press <kbd style={{ background: '#e6e6e6', color: '#000000', padding: '2px 5px', borderRadius: 3, border: '1px solid #ccc', fontWeight: 600 }}>Ctrl + Enter</kbd> to add note
          </span>
          <Button 
            type="primary" 
            size="small" 
            icon={<SendOutlined />}
            onClick={handleAddNote}
            disabled={!currentInput.trim()}
          >
            Add Note
          </Button>
        </div>
      </Card>

      {/* Saved Notes History List with user identity tags */}
      <Typography.Title level={5} style={{ fontSize: 14, marginBottom: 12 }}>
        Notes History ({notesList.length})
      </Typography.Title>

      {notesList.length === 0 ? (
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
          description="No notes added yet. Add a note above to record author, reviewer, or approver remarks." 
          style={{ margin: '20px 0' }}
        />
      ) : (
        <List
          itemLayout="vertical"
          dataSource={notesList}
          renderItem={(item) => {
            const authorEmail = item.user?.email || item.user?.name || 'User';
            const authorRole = item.user?.role || 'Contributor';
            const isNoteAuthor = item.user && (
              (item.user.id && (String(item.user.id) === String(activeUser.id || activeUser.userId))) ||
              (item.user.email && String(item.user.email).toLowerCase() === String(userEmail).toLowerCase())
            );
            const canDelete = isAdmin || isNoteAuthor;

            return (
              <List.Item
                style={{
                  background: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 10,
                  border: '1px solid #e8e8e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Space size={8}>
                    <Avatar size="small" style={{ backgroundColor: '#52c41a' }}>
                      {(authorEmail || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#000000', marginRight: 8 }}>
                        {authorEmail}
                      </span>
                      <Tag color="cyan" style={{ fontSize: 11, padding: '0 6px' }}>
                        {authorRole}
                      </Tag>
                    </div>
                  </Space>

                  <Space size={8}>
                    <span style={{ color: '#000000', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                      <ClockCircleOutlined style={{ marginRight: 4, color: '#000000' }} />
                      {item.timestamp ? moment(item.timestamp).format('MMM D, YYYY h:mm A') : 'Just now'}
                    </span>
                    {canDelete && (
                      <Tooltip title="Delete this note">
                        <Button 
                          type="text" 
                          danger 
                          size="small" 
                          icon={<DeleteOutlined />} 
                          onClick={() => handleDeleteNote(item.id)}
                        />
                      </Tooltip>
                    )}
                  </Space>
                </div>

                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap', paddingLeft: 32 }}>
                  {item.text}
                </div>
              </List.Item>
            );
          }}
        />
      )}

      <Divider style={{ margin: '16px 0' }} />

      <Typography.Title level={5} style={{ fontSize: 13, color: '#595959' }}>Usage Guidelines</Typography.Title>
      <ul style={{ fontSize: 12, color: '#666', paddingLeft: 20, margin: 0 }}>
        <li>Every added note automatically logs your email and role for auditing.</li>
        <li>Authors, reviewers, and approvers can post remarks regarding changes or approval steps.</li>
        <li>Notes are saved automatically and remain visible across review iterations. Only administrators can delete notes.</li>
      </ul>
    </Card>
  );
};

export default TemplateNotesTab;
