import { useState, useEffect, useRef, useCallback } from 'react';
import { previewDocumentNumber, listProjectNumbers, listCostCenterNumbers } from '../../../../../../api/numbers';

export function useDocumentNumbering({ user, form, document }) {
  const [documentNumber, setDocumentNumber] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [costCenterNumber, setCostCenterNumber] = useState('');
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableCostCenters, setAvailableCostCenters] = useState([]);
  const availableProjectsRef = useRef([]);
  const availableCostCentersRef = useRef([]);

  // Fetch document, project, and cost center number previews when department is chosen
  const fetchDocNumberPreview = useCallback(async (deptName, projs, ccs, currentDocId) => {
    const orgId = user?.orgId || user?.organization_id || user?.organizationId || user?.org_id;
    if (!orgId || !deptName) {
      setDocumentNumber('');
      setProjectNumber('');
      setCostCenterNumber('');
      form.setFieldsValue({ documentNumber: '', projectNumber: '', costCenterNumber: '' });
      return;
    }
    // If the document in this session was already created/persisted and has its official number, keep it
    if (currentDocId && documentNumber) return;
    try {
      const res = await previewDocumentNumber(orgId, deptName);
      if (res?.preview) {
        setDocumentNumber(res.preview);
        form.setFieldsValue({ documentNumber: res.preview });
      } else {
        setDocumentNumber('');
        form.setFieldsValue({ documentNumber: '' });
      }

      if (res?.projectPreview) {
        setProjectNumber(res.projectPreview);
        form.setFieldsValue({ projectNumber: res.projectPreview });
      } else {
        const pList = projs || availableProjectsRef.current || availableProjects || [];
        const matchedProj = (pList || []).find(
          p => p.status === 'active' && p.department && p.department.trim().toLowerCase() === deptName.trim().toLowerCase()
        ) || (pList || []).find(p => p.status === 'active' && !p.department) || (pList || []).find(p => p.status === 'active');
        if (matchedProj) {
          setProjectNumber(matchedProj.project_number);
          form.setFieldsValue({ projectNumber: matchedProj.project_number });
        }
      }

      if (res?.costCenterPreview) {
        setCostCenterNumber(res.costCenterPreview);
        form.setFieldsValue({ costCenterNumber: res.costCenterPreview });
      } else {
        const cList = ccs || availableCostCentersRef.current || availableCostCenters || [];
        const matchedCC = (cList || []).find(
          c => c.status === 'active' && c.department && c.department.trim().toLowerCase() === deptName.trim().toLowerCase()
        ) || (cList || []).find(c => c.status === 'active' && !c.department) || (cList || []).find(c => c.status === 'active');
        if (matchedCC) {
          setCostCenterNumber(matchedCC.cost_number);
          form.setFieldsValue({ costCenterNumber: matchedCC.cost_number });
        }
      }
    } catch (e) {
      console.warn('Could not preview numbers:', e);
    }
  }, [user, documentNumber, form, availableProjects, availableCostCenters]);

  // Automatically sync document, project, and cost center numbers based on department
  const updateDepartmentNumbers = useCallback((deptVal, projs, ccs, currentDocId) => {
    if (!deptVal) {
      setDocumentNumber('');
      setProjectNumber('');
      setCostCenterNumber('');
      form.setFieldsValue({ documentNumber: '', projectNumber: '', costCenterNumber: '' });
      return;
    }

    const pList = projs || availableProjectsRef.current || availableProjects || [];
    const cList = ccs || availableCostCentersRef.current || availableCostCenters || [];

    fetchDocNumberPreview(deptVal, pList, cList, currentDocId);
  }, [fetchDocNumberPreview, form, availableProjects, availableCostCenters]);

  // Fetch active project numbers and cost centers
  useEffect(() => {
    const orgId = user?.orgId || user?.organization_id || user?.organizationId || user?.org_id;
    if (!orgId) return;
    Promise.all([
      listProjectNumbers(orgId).catch(() => []),
      listCostCenterNumbers(orgId).catch(() => [])
    ]).then(([projs, ccs]) => {
      const p = projs || [];
      const c = ccs || [];
      availableProjectsRef.current = p;
      availableCostCentersRef.current = c;
      setAvailableProjects(p);
      setAvailableCostCenters(c);
      const currentDept = form.getFieldValue('department') || document?.department;
      if (currentDept) {
        updateDepartmentNumbers(currentDept, p, c);
      }
    });
  }, [user]);

  // When a base/published document is loaded into CreateDocument, update department numbers freshly
  useEffect(() => {
    if (document) {
      const currentDept = form.getFieldValue('department') || document?.department;
      if (currentDept) {
        updateDepartmentNumbers(currentDept);
      }
    }
  }, [document, form, updateDepartmentNumbers]);

  return {
    documentNumber,
    setDocumentNumber,
    projectNumber,
    setProjectNumber,
    costCenterNumber,
    setCostCenterNumber,
    availableProjects,
    availableCostCenters,
    updateDepartmentNumbers,
    fetchDocNumberPreview,
  };
}

export default useDocumentNumbering;
