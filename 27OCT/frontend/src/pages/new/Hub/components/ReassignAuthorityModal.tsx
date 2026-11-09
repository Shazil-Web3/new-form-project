/**
 * @file ReassignAuthorityModal.jsx
 * @description Modal dialog allowing admins, authors, or assigned users to reassign a pending reviewer/approver role to a colleague from the same department
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal, Select } from 'antd';
import apiClient from '../../../../api/apiClient';
import { successAlert, errorAlert } from '../../../../utils/alerts';

export default function ReassignAuthorityModal({
  visible,
  onClose,
  targetUser,
  item,
  currentUser,
  users = [],
  departments = [],
  onSuccess,
  initialAssignee = null,
}) {
  const [selectedAssignee, setSelectedAssignee] = useState(initialAssignee);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedAssignee(initialAssignee);
  }, [visible, targetUser?.id, targetUser?.userId, targetUser?.email, initialAssignee]);

  const currentUserId = currentUser?.id ?? currentUser?.userId;
  const isOwner = currentUserId !== undefined && item?.created_by !== undefined && (
    String(currentUserId) === String(item.created_by)
  );
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'project_manager';
  const isSelf = (currentUserId !== undefined && String(targetUser?.userId ?? targetUser?.id) === String(currentUserId)) ||
    (currentUser?.email && targetUser?.email && currentUser.email.toLowerCase() === targetUser.email.toLowerCase());

  if (!visible || !targetUser || !item || (!isAdmin && !isOwner && !isSelf)) return null;

  const isDoc = item.itemType === 'document' || Boolean(item.document_id);
  const itemTypeLabel = isDoc ? 'Document' : 'Template';

  // Find department of target user (from targetUser directly or by finding targetUser in users list)
  const fullTargetUser = users.find(u =>
    String(u.id ?? u.userId) === String(targetUser.userId ?? targetUser.id) ||
    (targetUser.email && u.email && u.email.toLowerCase() === targetUser.email.toLowerCase())
  );
  const targetDept = targetUser.department || fullTargetUser?.department || (isSelf ? currentUser?.department : null);

  // Filter eligible colleagues strictly in the same department
  const getEligibleAssignees = () => {
    if (!targetDept) return [];

    // Current workflow participant IDs to exclude
    const rawApprovers = item.template_approvers || item.approvers;
    const parsed = rawApprovers ? (typeof rawApprovers === 'string' ? JSON.parse(rawApprovers) : rawApprovers) : {};
    const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
    const approversList = Array.isArray(parsed.approvers) ? parsed.approvers : [];
    const currentWfUserIds = new Set([
      ...reviewers.map(u => String(u.userId ?? u.id)),
      ...approversList.map(u => String(u.userId ?? u.id)),
      String(targetUser.userId ?? targetUser.id)
    ]);
    const currentWfEmails = new Set([
      ...reviewers.map(u => (u.email || '').toLowerCase()),
      ...approversList.map(u => (u.email || '').toLowerCase()),
      (targetUser.email || '').toLowerCase()
    ]);

    // Strictly users who belong to targetDept
    return users.filter(u => {
      const uId = String(u.id ?? u.userId);
      const uEmail = (u.email || '').toLowerCase();
      if (currentWfUserIds.has(uId) || currentWfEmails.has(uEmail)) return false;
      if (u.status && u.status !== 'active') return false;

      // Must strictly match targetDept
      return u.department && u.department.trim().toLowerCase() === targetDept.trim().toLowerCase();
    });
  };

  const eligibleAssignees = getEligibleAssignees();

  const handleSubmit = async () => {
    if (!selectedAssignee) {
      errorAlert('Warning', 'Please select a member to assign this authority to.');
      return;
    }

    const assigneeUser = users.find(u => String(u.id ?? u.userId) === String(selectedAssignee));
    if (!assigneeUser) return;

    setLoading(true);
    try {
      const endpoint = isDoc
        ? `/api/documents/${item.id}/reassign`
        : `/api/templates/${item.id}/reassign`;

      const payload = {
        currentUserId: targetUser.userId || targetUser.id,
        targetEmail: targetUser.email,
        newUser: {
          id: assigneeUser.id || assigneeUser.userId,
          name: assigneeUser.name || `${assigneeUser.first_name || ''} ${assigneeUser.last_name || ''}`.trim(),
          email: assigneeUser.email,
          department: assigneeUser.department || targetDept
        }
      };

      const res = await apiClient.put(endpoint, payload);
      if (res && res.data && res.data.success) {
        successAlert('Success', `${itemTypeLabel} authority reassigned successfully.`);
        onClose();
        if (onSuccess) onSuccess(payload.newUser);
      } else {
        errorAlert('Error', res?.data?.error || 'Failed to reassign authority.');
      }
    } catch (err) {
      console.error('Reassign error:', err);
      errorAlert('Error', err.response?.data?.error || 'Failed to reassign authority.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Assign ${itemTypeLabel} Authority`}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText="Assign"
      cancelText="Cancel"
      destroyOnHidden
      width={500}
    >
      <div className="py-2 space-y-4 text-sm text-on-surface">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="text-xs text-on-surface-variant font-medium">Currently Assigned To:</div>
          <div className="font-semibold text-sm text-slate-800 flex items-center justify-between mt-0.5">
            <span>{targetUser.name || 'User'}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold uppercase">
              {targetUser.role || 'Reviewer'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {targetUser.email} {targetDept ? `• ${targetDept}` : ''}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-slate-600">
            Select a colleague {targetDept ? `from the ${targetDept} department ` : ''}to assign this {itemTypeLabel.toLowerCase()} to:
          </div>
          <Select
            className="w-full"
            placeholder="Select a colleague"
            value={selectedAssignee}
            onChange={(val) => setSelectedAssignee(val)}
            showSearch
            optionFilterProp="children"
            notFoundContent={
              <div className="py-2 text-center text-xs text-slate-400">
                No eligible colleagues found in {targetDept || 'department'}
              </div>
            }
          >
            {eligibleAssignees.map(u => (
              <Select.Option key={String(u.id ?? u.userId)} value={String(u.id ?? u.userId)}>
                <div className="flex items-center justify-between">
                  <span>{u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim()} ({u.email})</span>
                  {u.department && (
                    <span className="text-[10px] text-slate-400 ml-2">{u.department}</span>
                  )}
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}

ReassignAuthorityModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  targetUser: PropTypes.object,
  item: PropTypes.object,
  currentUser: PropTypes.object,
  users: PropTypes.array,
  departments: PropTypes.array,
  onSuccess: PropTypes.func,
};
