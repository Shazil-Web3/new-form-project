import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../utils/authService';
import apiClient from '../../../api/apiClient';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import CreateTemplateContainer from '../../../components/Home/components/Dashboard/Templates/CreateTemplate/CreateTemplateContainer';
import { Spin } from 'antd';

export default function CreateTemplateHub() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      const userId = user?.id || user?.userId;
      const orgId = user?.organization_id || user?.orgId || user?.org_id;
      if (!userId || !orgId) return;

      try {
        setLoading(true);

        const [usersRes, catRes, deptRes, tempRes] = await Promise.allSettled([
          apiClient.get('/api/users').catch(() => apiClient.get(`/api/org_members/${userId}`)),
          apiClient.get(`/api/template_categories/${orgId}`),
          apiClient.get(`/api/departments/${orgId}`),
          apiClient.get(`/api/templates/${userId}`)
        ]);

        if (!isMounted) return;

        if (usersRes.status === 'fulfilled') {
          const raw = usersRes.value?.data;
          setUsers(Array.isArray(raw) ? raw : raw?.data || []);
        }
        if (catRes.status === 'fulfilled') {
          const raw = catRes.value?.data;
          setCategories(Array.isArray(raw) ? raw : raw?.data || []);
        }
        if (deptRes.status === 'fulfilled') {
          const raw = deptRes.value?.data;
          setDepartments(Array.isArray(raw) ? raw : raw?.data || []);
        }
        if (tempRes.status === 'fulfilled') {
          const raw = tempRes.value?.data;
          setTemplates(Array.isArray(raw) ? raw : raw?.data || []);
        }
      } catch (err) {
        console.error('Error loading template creation dependencies:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [user]);

  return (
    <MainLayout fullWidth={true}>
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spin size="large" />
          <span className="text-sm font-medium text-slate-500">Loading template editor...</span>
        </div>
      ) : (
        <CreateTemplateContainer
          user={user}
          users={users}
          categories={categories}
          departments={departments}
          templates={templates}
          onSuccess={() => navigate('/dashboard')}
          onCancel={() => navigate('/dashboard')}
        />
      )}
    </MainLayout>
  );
}
