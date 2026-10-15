import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../utils/authService';
import apiClient from '../../../api/apiClient';
import { getDocumentsForRelated } from '../../../api/documents';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import CreateDocument from '../../../components/Home/components/Dashboard/Documents/CreateDocument';
import { Spin } from 'antd';

import ObsoleteReferenceWarningBar from '../../../components/Unified/UnifiedTextEditor/components/ObsoleteReferenceWarningBar';
import { useObsoleteReferences } from '../../../components/Unified/UnifiedTextEditor/hooks/useObsoleteReferences';

export default function CreateDocumentHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateIdFromUrl = searchParams.get('templateId');
  const documentIdFromUrl = searchParams.get('documentId') || searchParams.get('docId');

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  // relatedCandidates = in-flight docs (draft/review/approval) for the Related Documents dropdown
  const [relatedCandidates, setRelatedCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  const { obsoleteDocs } = useObsoleteReferences({
    sourceType: documentIdFromUrl ? 'document' : 'template',
    sourceId: documentIdFromUrl || templateIdFromUrl,
    content: selectedDocument?.content || selectedTemplate?.content,
    elements: selectedTemplate?.comments || []
  });

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      const userId = user?.id || user?.userId;
      const orgId = user?.organization_id || user?.orgId || user?.org_id;
      if (!userId || !orgId) return;

      try {
        setLoading(true);

        const requests = [
          apiClient.get('/api/users').catch(() => apiClient.get(`/api/org_members/${userId}`)),
          apiClient.get(`/api/departments/${orgId}`),
          apiClient.get(`/api/templates/${userId}`),
          getDocumentsForRelated().catch(() => []),
        ];

        if (templateIdFromUrl) {
          requests.push(apiClient.get(`/api/get_template/${templateIdFromUrl}`).catch(() => null));
        } else if (documentIdFromUrl) {
          requests.push(apiClient.get(`/api/get_document/${documentIdFromUrl}`).catch(() => null));
        }

        const results = await Promise.allSettled(requests);

        if (!isMounted) return;

        const [usersRes, deptRes, tempRes, pubDocsRes, singleItemRes] = results;

        let loadedUsers = [];
        let loadedDepts = [];
        let loadedTemplates = [];

        if (usersRes?.status === 'fulfilled') {
          const raw = usersRes.value?.data;
          loadedUsers = Array.isArray(raw) ? raw : raw?.data || [];
          setUsers(loadedUsers);
        }
        if (deptRes?.status === 'fulfilled') {
          const raw = deptRes.value?.data;
          loadedDepts = Array.isArray(raw) ? raw : raw?.data || [];
          setDepartments(loadedDepts);
        }
        if (tempRes?.status === 'fulfilled') {
          const raw = tempRes.value?.data;
          loadedTemplates = Array.isArray(raw) ? raw : raw?.data || [];
          setTemplates(loadedTemplates);
        }

        // Store in-flight documents for the Related Documents dropdown (draft, review, approval)
        if (pubDocsRes?.status === 'fulfilled') {
          const val = pubDocsRes.value;
          const raw = Array.isArray(val) ? val : val?.data || [];
          setRelatedCandidates(Array.isArray(raw) ? raw : []);
        }

        // Resolve selected template if URL had templateId
        if (templateIdFromUrl) {
          let matched = null;
          if (singleItemRes?.status === 'fulfilled' && singleItemRes.value?.data) {
            const raw = singleItemRes.value.data;
            matched = raw?.template || raw;
          }
          if (!matched) {
            matched = loadedTemplates.find((t) => String(t.id) === String(templateIdFromUrl));
          }
          if (matched) {
            setSelectedTemplate(matched);
          }
        } else if (documentIdFromUrl) {
          if (singleItemRes?.status === 'fulfilled' && singleItemRes.value?.data) {
            const raw = singleItemRes.value.data;
            const doc = raw?.document || raw;
            if (doc) {
              setSelectedDocument(doc);
            }
          }
        }
      } catch (err) {
        console.error('Error loading document creation dependencies:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user, templateIdFromUrl, documentIdFromUrl]);

  return (
    <MainLayout fullWidth={true}>
      <ObsoleteReferenceWarningBar
        obsoleteDocs={obsoleteDocs}
        itemType={documentIdFromUrl ? 'document' : 'template'}
      />
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spin size="large" />
          <span className="text-sm font-medium text-slate-500">Loading document editor...</span>
        </div>
      ) : (
        <CreateDocument
          navigate={navigate}
          user={user}
          users={users}
          templates={templates}
          template={selectedTemplate}
          document={selectedDocument}
          departments={departments}
          relatedDocumentCandidates={relatedCandidates}
          publishedDocuments={relatedCandidates}
          onSuccess={() => navigate('/dashboard')}
          onCancel={() => navigate('/dashboard')}
        />
      )}
    </MainLayout>
  );
}
