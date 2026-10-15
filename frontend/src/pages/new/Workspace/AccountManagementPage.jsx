import React, { useCallback, useEffect, useRef, useState } from 'react';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import Accounts from '../../../components/Home/components/Dashboard/Accounts';
import PasswordConfirmModal from '../../../components/Home/components/Modals/PasswordConfirmModal';
import { useAuth } from '../../../utils/authService';
import { listOrgMembers, listInvited, listDepartments, listSites } from '../../../api/users';
import { listTemplates } from '../../../api/templates';
import { verifyPassword } from '../../../api/auth';
import { Spin, message } from 'antd';

const AccountManagementPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordConfirmCallback, setPasswordConfirmCallback] = useState(null);
  const confirmationInProgress = useRef(false);

  const orgId = user?.orgId || user?.organization_id || user?.organizationId || user?.org_id;

  const getConsistentColor = useCallback((str) => {
    if (!str) return 'default';
    const antColors = [
      'red', 'volcano', 'orange', 'gold', 'yellow', 'lime', 'green',
      'cyan', 'blue', 'geekblue', 'purple', 'magenta'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash &= hash;
    }
    const index = Math.abs(hash) % antColors.length;
    return antColors[index];
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [usersData, invitedData, departmentsData, sitesData, templatesData] = await Promise.all([
        listOrgMembers(user.id),
        listInvited(user.id),
        listDepartments(orgId),
        listSites(orgId),
        listTemplates(user.id)
      ]);

      setUsers(usersData || []);
      setInvitedUsers(invitedData || []);
      setDepartments(departmentsData || []);
      setSites(sitesData || []);
      setTemplates(Array.isArray(templatesData) ? templatesData : (templatesData?.data || []));
    } catch (error) {
      console.error('Failed to load account management data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, orgId]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user, fetchUserData]);

  const requirePasswordConfirmation = useCallback((callback) => {
    if (confirmationInProgress.current) return;
    confirmationInProgress.current = true;
    setPasswordConfirmCallback(() => async () => {
      await callback();
      confirmationInProgress.current = false;
    });
    setPasswordModalVisible(true);
  }, []);

  const handlePasswordConfirmed = useCallback(async (password) => {
    try {
      const response = await verifyPassword(password);
      if (response?.verified) {
        setPasswordModalVisible(false);
        if (passwordConfirmCallback) {
          await passwordConfirmCallback();
        }
        confirmationInProgress.current = false;
      } else {
        const errorMsg = response?.error || 'Incorrect password. Please enter your account password.';
        message.error(errorMsg);
        confirmationInProgress.current = false;
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Password verification failed:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Incorrect password. Please enter your account password.';
      message.error(errorMsg);
      confirmationInProgress.current = false;
      throw error;
    }
  }, [passwordConfirmCallback]);

  const handlePasswordModalCancel = useCallback(() => {
    setPasswordModalVisible(false);
    confirmationInProgress.current = false;
    setPasswordConfirmCallback(null);
  }, []);

  if (!user) {
    return (
      <MainLayout showSearch={false}>
        <div className="flex items-center justify-center h-[calc(100vh-96px)]">
          <Spin size="large" tip="Loading account management..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSearch={false}>
      <div className="max-w-container_max_width mx-auto py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spin size="large" tip="Loading account management..." />
          </div>
        ) : (
          <Accounts
            requirePasswordConfirmation={requirePasswordConfirmation}
            users={users}
            invitedUsers={invitedUsers}
            user={user}
            fetchUserData={fetchUserData}
            departments={departments}
            sites={sites}
            templates={templates}
            getConsistentColor={getConsistentColor}
          />
        )}

        <PasswordConfirmModal
          visible={passwordModalVisible}
          onCancel={handlePasswordModalCancel}
          onConfirm={handlePasswordConfirmed}
        />
      </div>
    </MainLayout>
  );
};

export default AccountManagementPage;
