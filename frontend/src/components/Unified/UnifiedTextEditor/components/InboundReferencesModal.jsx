/**
 * @file InboundReferencesModal.jsx
 * @description Modal dialog shown when an author/admin attempts to archive a document that is actively referenced by other documents or templates.
 * Displays referencing items with their status and author details, and prevents archiving until references are removed.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, Tag, Typography } from 'antd';
import { WarningOutlined, FileTextOutlined, AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export default function InboundReferencesModal({
  visible,
  onClose,
  documentTitle,
  referencingItems = [],
  onRecheck,
  isRechecking = false
}) {
  const getStatusTagColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'published' || s === 'active') return 'green';
    if (s === 'draft' || s === 'pending_revision') return 'default';
    if (s.includes('review')) return 'orange';
    if (s.includes('approval') || s === 'approved') return 'blue';
    return 'default';
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2.5 text-amber-700 font-bold text-base">
          <span className="p-1.5 bg-amber-100 rounded-lg flex items-center justify-center">
            <WarningOutlined className="text-amber-600 text-lg" />
          </span>
          <span>Cannot Archive Document</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button
          key="recheck"
          icon={<ReloadOutlined spin={isRechecking} />}
          onClick={onRecheck}
          loading={isRechecking}
          className="rounded-lg font-medium"
        >
          Check Again
        </Button>,
        <Button
          key="close"
          type="primary"
          onClick={onClose}
          className="rounded-lg font-medium bg-blue-700 hover:bg-blue-800"
        >
          I Understand
        </Button>
      ]}
      width={640}
      centered
      destroyOnClose
    >
      <div className="py-2 flex flex-col gap-4">
        <div>
          <Paragraph className="text-sm text-slate-700 mb-1">
            <Text strong className="text-slate-900">
              "{documentTitle || 'This document'}"
            </Text>{' '}
            cannot be archived right now because it is currently cited or referenced in the text editor of the following active item(s):
          </Paragraph>
          <Text type="secondary" className="text-xs">
            To archive this document, the authors of the items below must remove the <Text code>@mention</Text> link to this document from their text editor.
          </Text>
        </div>

        {/* List of referencing items */}
        <div className="max-h-[320px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
          {referencingItems.map((item, idx) => {
            const isDoc = item.type === 'document';
            return (
              <div
                key={item.id || idx}
                className="p-3.5 hover:bg-white transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${isDoc ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {isDoc ? <FileTextOutlined className="text-base" /> : <AppstoreOutlined className="text-base" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 truncate max-w-[280px]">
                        {item.title || 'Untitled'}
                      </span>
                      <Tag color={getStatusTagColor(item.status)} className="m-0 text-[11px] font-semibold uppercase">
                        {item.status || 'Active'}
                      </Tag>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      {item.number && (
                        <span className="font-mono bg-slate-200/60 px-1.5 py-0.2 rounded font-semibold text-slate-700">
                          {item.number}
                        </span>
                      )}
                      <span>Author: <strong className="text-slate-700">{item.author || 'Author'}</strong></span>
                      {item.department && <span>Dept: <strong className="text-slate-700">{item.department}</strong></span>}
                      {item.version && <span>v{item.version}</span>}
                    </div>
                  </div>
                </div>

                <a
                  href={isDoc ? `/document/${item.id}` : `/template/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <span>Open</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </div>
            );
          })}
        </div>

        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] text-blue-700 mt-0.5">info</span>
          <span>
            Once the reference is removed and saved in the referencing document's editor, click <strong>Check Again</strong> to refresh the status. The archive button will automatically become active.
          </span>
        </div>
      </div>
    </Modal>
  );
}

InboundReferencesModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  documentTitle: PropTypes.string,
  referencingItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      type: PropTypes.string,
      title: PropTypes.string,
      status: PropTypes.string,
      number: PropTypes.string,
      version: PropTypes.string,
      department: PropTypes.string,
      author: PropTypes.string
    })
  ),
  onRecheck: PropTypes.func,
  isRechecking: PropTypes.bool
};
