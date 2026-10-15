import React, { useState, useEffect } from 'react';
import { Input, Button, List, Typography, Tooltip, Empty, message, Popconfirm } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';
import './ReferencesTab.css';

const { TextArea } = Input;
const { Text, Title } = Typography;

const ReferencesTab = ({
  references = [],
  manualReferences = [],
  onReferencesChange,
  onManualReferencesChange,
  canEdit = true,
  obsoleteDocIds = []
}) => {
  const [localReferences, setLocalReferences] = useState([]);
  const [localManualReferences, setLocalManualReferences] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const obsoleteSet = React.useMemo(() => new Set((obsoleteDocIds || []).map(String)), [obsoleteDocIds]);

  useEffect(() => {
    // Partition references if manualReferences is empty but some references are manual (backward compatibility)
    if (manualReferences.length === 0 && references.some(r => r.isManual)) {
      setLocalReferences(references.filter(r => !r.isManual && r.refAnchor) || []);
      setLocalManualReferences(references.filter(r => r.isManual || !r.refAnchor) || []);
    } else {
      setLocalReferences(references || []);
      setLocalManualReferences(manualReferences || []);
    }
  }, [references, manualReferences]);

  const handleUpdateReference = (id, field, value) => {
    const isManualRef = localManualReferences.some(r => r.id === id);
    if (isManualRef) {
      const updated = localManualReferences.map(ref =>
        ref.id === id ? { ...ref, [field]: value } : ref
      );
      setLocalManualReferences(updated);
      if (onManualReferencesChange) {
        onManualReferencesChange(updated);
      } else if (onReferencesChange) {
        // Fallback backward compatibility
        onReferencesChange([...localReferences, ...updated]);
      }
    } else {
      const updated = localReferences.map(ref =>
        ref.id === id ? { ...ref, [field]: value } : ref
      );
      setLocalReferences(updated);
      if (onReferencesChange) {
        if (onManualReferencesChange) {
          onReferencesChange(updated);
        } else {
          // Fallback backward compatibility
          onReferencesChange([...updated, ...localManualReferences]);
        }
      }
    }
  };

  const handleAddManualReference = () => {
    const newId = `manual-ref-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newRef = {
      id: newId,
      refAnchor: '',
      refNumber: null,
      refText: '',
      refContent: '',
      timestamp: new Date().toISOString(),
      type: 'reference',
      isManual: true
    };
    const updated = [...localManualReferences, newRef];
    setLocalManualReferences(updated);
    if (onManualReferencesChange) {
      onManualReferencesChange(updated);
    } else if (onReferencesChange) {
      // Fallback backward compatibility
      onReferencesChange([...localReferences, ...updated]);
    }
    message.success('New reference entry added');
  };

  const handleDeleteReference = (id) => {
    const isManualRef = localManualReferences.some(r => r.id === id);
    if (isManualRef) {
      const updated = localManualReferences.filter(ref => ref.id !== id);
      setLocalManualReferences(updated);
      if (onManualReferencesChange) {
        onManualReferencesChange(updated);
      } else if (onReferencesChange) {
        // Fallback backward compatibility
        onReferencesChange([...localReferences, ...updated]);
      }
    } else {
      const updated = localReferences.filter(ref => ref.id !== id);
      setLocalReferences(updated);
      if (onReferencesChange) {
        if (onManualReferencesChange) {
          onReferencesChange(updated);
        } else {
          // Fallback backward compatibility
          onReferencesChange([...updated, ...localManualReferences]);
        }
      }
    }
    message.success('Reference removed');
  };

  const filterRefs = (refs) => {
    return refs.filter(ref => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        (ref.refText && ref.refText.toLowerCase().includes(search)) ||
        (ref.refContent && ref.refContent.toLowerCase().includes(search)) ||
        (ref.refNumber != null && ref.refNumber.toString().includes(search))
      );
    });
  };

  const documentReferences = filterRefs(localReferences);
  const generalReferences = filterRefs(localManualReferences);

  const renderReferenceItem = (item) => {
    const itemDocId = item.documentId || item.document_id || item.docId || item.targetId || (item.refAnchor && item.refAnchor.match(/\/document\/([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/)?.[1]);
    const isObsolete = itemDocId && obsoleteSet.has(String(itemDocId));

    return (
      <List.Item
        key={item.id}
        id={`ref-entry-${item.id}`}
        className="reference-item"
        actions={canEdit && item.isManual ? [
          <Popconfirm
            title="Remove?"
            onConfirm={() => handleDeleteReference(item.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ] : []}
      >
        <div className="reference-item-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {item.refNumber && (
              <div className="ref-number-badge">[{item.refNumber}]</div>
            )}
            {isObsolete && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid #fca5a5'
                }}
                title="This referenced document has become obsolete. You need to revise your document."
              >
                Obsolete
              </span>
            )}
          </div>
          <div className="ref-details" style={{ width: item.refNumber ? 'calc(100% - 36px)' : '100%' }}>
            <div className="ref-content-edit">
              {canEdit ? (
                <TextArea
                  value={item.refContent || item.refText}
                  onChange={e => handleUpdateReference(item.id, 'refContent', e.target.value)}
                  placeholder="Enter reference text..."
                  autoSize={{ minRows: 1, maxRows: 10 }}
                  className="ref-textarea"
                  variant="borderless"
                />
              ) : (
                <div className="ref-content-display">
                  {item.refContent || item.refText || <Text type="secondary">No content</Text>}
                </div>
              )}
            </div>
          </div>
        </div>
      </List.Item>
    );
  };

  return (
    <div className="references-panel">
      <div className="references-header">
        <Input
          placeholder="Search..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="ref-search"
          variant="borderless"
        />
        {canEdit && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddManualReference}
            style={{ borderRadius: '4px' }}
          >
            Add Reference
          </Button>
        )}
      </div>

      <div className="references-container">
        {documentReferences.length === 0 && generalReferences.length === 0 ? (
          <Empty description="No references found" style={{ marginTop: '40px' }} />
        ) : (
          <>
            {documentReferences.length > 0 && (
              <div className="ref-section">
                <div className="ref-section-header">
                  <Title level={5}>Document References</Title>
                </div>
                <List
                  className="references-list"
                  itemLayout="horizontal"
                  dataSource={documentReferences}
                  renderItem={renderReferenceItem}
                />
              </div>
            )}

            {generalReferences.length > 0 && (
              <div className="ref-section" style={{ marginTop: documentReferences.length > 0 ? '24px' : '0' }}>
                <div className="ref-section-header">
                  <Title level={5}>General References</Title>
                </div>
                <List
                  className="references-list"
                  itemLayout="horizontal"
                  dataSource={generalReferences}
                  renderItem={renderReferenceItem}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReferencesTab;
