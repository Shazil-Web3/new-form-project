import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../utils/authService';
import apiClient from '../../../api/apiClient';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import EditTemplate from '../../../components/Home/components/Dashboard/Templates/EditTemplate';
import ReviseTemplate from '../../../components/Home/components/Dashboard/Templates/ReviseTemplate';
import ArchiveTemplate from '../../../components/Home/components/Dashboard/Templates/ArchiveTemplate';
import TemplatePreview from '../../../components/Unified/UnifiedTextEditor/Preview/TemplatePreview';
import ObsoleteReferenceWarningBar from '../../../components/Unified/UnifiedTextEditor/components/ObsoleteReferenceWarningBar';
import { useObsoleteReferences } from '../../../components/Unified/UnifiedTextEditor/hooks/useObsoleteReferences';
import { Spin } from 'antd';

export default function EditTemplateHub() {
  const { tempId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [template, setTemplate] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRevising, setIsRevising] = useState(searchParams.get('revise') === 'true');
  const [isArchiving, setIsArchiving] = useState(searchParams.get('archive') === 'true');

  const { obsoleteDocs } = useObsoleteReferences({
    sourceType: 'template',
    sourceId: tempId,
    content: template?.content,
    elements: template?.comments
  });

  useEffect(() => {
    if (searchParams.get('revise') === 'true') {
      setIsRevising(true);
    }
    if (searchParams.get('archive') === 'true' || template?.status === 'archive_draft' || template?.status === 'archive_reviewed') {
      setIsArchiving(true);
    }
  }, [searchParams, template?.status]);

  const loadData = async () => {
    const userId = user?.id || user?.userId;
    const orgId = user?.organization_id || user?.orgId || user?.org_id;
    if (!userId || !orgId) return;

    try {
      setLoading(true);
      const [tempRes, usersRes, catRes, deptRes, allTempsRes] = await Promise.allSettled([
        apiClient.get(`/api/get_template/${tempId}`),
        apiClient.get('/api/users').catch(() => apiClient.get(`/api/org_members/${userId}`)),
        apiClient.get(`/api/template_categories/${orgId}`),
        apiClient.get(`/api/departments/${orgId}`),
        apiClient.get(`/api/templates/${userId}`)
      ]);

      if (tempRes.status === 'fulfilled' && tempRes.value?.data) {
        const raw = tempRes.value.data;
        setTemplate(raw?.template || raw);
      }
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
      if (allTempsRes.status === 'fulfilled') {
        const raw = allTempsRes.value?.data;
        setTemplates(Array.isArray(raw) ? raw : raw?.data || []);
      }
    } catch (err) {
      console.error('Error loading template dependencies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tempId, user?.id]);

  const handleBack = () => {
    if (window.history && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const obsoleteDocIds = obsoleteDocs.map((d) => d.id);

  return (
    <MainLayout fullWidth={true}>
      <ObsoleteReferenceWarningBar
        obsoleteDocs={obsoleteDocs}
        itemType="template"
        onRevise={() => setIsRevising(true)}
        canRevise={true}
      />
      {loading || !template ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" tip="Loading template..." />
        </div>
      ) : isArchiving ? (
        <ArchiveTemplate
          template={template}
          user={user}
          users={users}
          categories={categories}
          departments={departments}
          templates={templates}
          fetchUserData={loadData}
          onCancel={handleBack}
          onSuccess={handleBack}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : isRevising ? (
        <ReviseTemplate
          isRevising={true}
          isRevise={true}
          template={template}
          user={user}
          users={users}
          categories={categories}
          departments={departments}
          templates={templates}
          fetchUserData={loadData}
          onCancel={handleBack}
          onSuccess={handleBack}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : template.status === 'draft' ? (
        <EditTemplate
          template={template}
          user={user}
          users={users}
          categories={categories}
          departments={departments}
          templates={templates}
          fetchUserData={loadData}
          onCancel={handleBack}
          onSuccess={handleBack}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : (
        <TemplatePreview
          template={template}
          currentUser={user}
          users={users}
          categories={categories}
          departments={departments}
          fetchUserData={loadData}
          onCancel={handleBack}
          onRevise={() => setIsRevising(true)}
          onArchive={() => setIsArchiving(true)}
          obsoleteDocIds={obsoleteDocIds}
        />
      )}
    </MainLayout>
  );
}
