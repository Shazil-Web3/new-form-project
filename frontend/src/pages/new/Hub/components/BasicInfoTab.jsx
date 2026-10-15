/**
 * @file BasicInfoTab.jsx
 * @description Metadata form tab for document/template creation wizards.
 *   Uses SearchableSelect for all option-heavy dropdowns.
 * @dependencies react, prop-types, SearchableSelect
 * @author Codegen
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import SearchableSelect from '../../../../components/new/tailwind/SearchableSelect';
import MultiSearchableSelect from '../../../../components/new/tailwind/MultiSearchableSelect';
import apiClient from '../../../../api/apiClient';

/**
 * BasicInfoTab - Redesigned Metadata Form
 *
 * Conditionally renders fields for Documents or Templates:
 * - Documents: Name, Template layout reference, Department, Site location, Due Date.
 * - Templates: Name, Category selection, Department.
 */
export default function BasicInfoTab({
  isDocument = true,
  values = {},
  onChange,
  templates = [],
  categories = [],
  departments = [],
  sites = [],
  disabled = false,
  fileId = null,
  relatedDocumentCandidates = [],
  publishedDocuments = [],
}) {
  const [nameWarning, setNameWarning] = useState(null);
  const debounceTimerRef = useRef(null);

  const templateOptions = templates.map((tpl) => ({
    value: String(tpl.id || tpl.template_id || ''),
    label: String(tpl.name || tpl.title || ''),
  }));

  const categoryOptions = categories.map((cat) => ({
    value: String(cat.id || cat.category_id || ''),
    label: String(cat.name || cat.category_name || ''),
  }));

  const departmentOptions = departments.map((dept) => ({
    value: String(dept.id || dept.department_id || ''),
    label: String(dept.name || dept.department_name || dept.dept_name || ''),
  }));

  const siteOptions = sites.map((site) => ({
    value: String(site.id || site.site_id || ''),
    label: String(site.name || site.site_name || ''),
  }));

  // Related Documents dropdown:
  // Published documents CANNOT be selected in the related documents.
  // Documents in review, documents in approval, as well as in draft can be selected.
  const candidateDocs = (relatedDocumentCandidates && relatedDocumentCandidates.length > 0)
    ? relatedDocumentCandidates
    : publishedDocuments;

  const relatedDocOptions = candidateDocs
    .filter(doc => doc.status !== 'published' && doc.status !== 'revised' && doc.status !== 'archived')
    .map((doc) => ({
      value: String(doc.document_id || ''),
      label: String(doc.title || ''),
      badge: doc.status
        ? doc.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : undefined,
    }));

  // Currently selected related document IDs (always an array)
  const selectedRelatedIds = Array.isArray(values.related_document_ids)
    ? values.related_document_ids.map(String)
    : [];

  const currentName = isDocument ? (values.title || '') : (values.name || '');

  // Debounced real-time conflict checking
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!currentName || !currentName.trim()) {
      setNameWarning(null);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get('/api/check-name-conflict', {
          params: {
            name: currentName.trim(),
            type: isDocument ? 'document' : 'template',
            excludeId: fileId || undefined,
          },
        });
        if (res.data && res.data.available === false) {
          setNameWarning(res.data.message || `A ${res.data.conflictType || 'record'} with this name already exists.`);
        } else {
          setNameWarning(null);
        }
      } catch (err) {
        console.warn('Name check error:', err);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [currentName, isDocument, fileId]);

  return (
    <div className="space-y-5 select-none animate-fade-in">
      {/* Title / Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          {isDocument ? 'Document Title' : 'Template Name'} <span className="text-error">*</span>
        </label>
        <input
          type="text"
          disabled={disabled}
          value={currentName}
          onChange={(e) => onChange(isDocument ? 'title' : 'name', e.target.value)}
          placeholder={isDocument ? 'Enter document name...' : 'Enter template schema name...'}
          className={`w-full h-11 px-3 bg-surface-container-lowest border rounded-xl focus:outline-none focus:ring-1 text-body-md text-on-surface shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
            nameWarning ? 'border-red-500 focus:ring-red-500' : 'border-outline-variant focus:ring-blue-700'
          }`}
          required
        />
        {nameWarning && (
          <p className="text-xs text-red-500 mt-1 font-medium">{nameWarning}</p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Description
        </label>
        <textarea
          disabled={disabled}
          value={values.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          placeholder={isDocument ? 'Describe the purpose of this document...' : 'Describe what this template is used for and any important details...'}
          className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm resize-y disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Base Template (Documents only) */}
      {isDocument && (
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm font-semibold text-on-surface-variant">
            Base Template Layout <span className="text-error">*</span>
          </label>
          <SearchableSelect
            value={String(values.template_id || '')}
            onChange={(val) => onChange('template_id', val)}
            options={templateOptions}
            placeholder="Select base template layout..."
            disabled={disabled}
            required
          />
        </div>
      )}

      {/* Category (Templates only) */}
      {!isDocument && (
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm font-semibold text-on-surface-variant">
            Category
          </label>
          <SearchableSelect
            value={String(values.category_id || '')}
            onChange={(val) => onChange('category_id', val)}
            options={categoryOptions}
            placeholder="Select category..."
            disabled={disabled}
            required
          />
        </div>
      )}

      {/* Department */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Assigned Department
        </label>
        <SearchableSelect
          value={String(values.department_id || '')}
          onChange={(val) => onChange('department_id', val)}
          options={departmentOptions}
          placeholder="Select target department..."
          disabled={disabled}
          required
        />
      </div>

      {/* Site & Due Date (Documents only) / Due Date (Templates) */}
      {isDocument ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm font-semibold text-on-surface-variant">
              Site / Location
            </label>
            <SearchableSelect
              value={String(values.site_id || '')}
              onChange={(val) => onChange('site_id', val)}
              options={siteOptions}
              placeholder="Select site (Optional)..."
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm font-semibold text-on-surface-variant">
              Target Due Date <span className="text-error">*</span>
            </label>
            <input
              type="date"
              disabled={disabled}
              value={values.due_date || ''}
              onChange={(e) => onChange('due_date', e.target.value)}
              className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant hover:border-blue-600/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
              required
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-label-sm font-semibold text-on-surface-variant">
            Target Due Date <span className="text-error">*</span>
          </label>
          <input
            type="date"
            disabled={disabled}
            value={values.due_date || ''}
            onChange={(e) => onChange('due_date', e.target.value)}
            className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant hover:border-blue-600/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
            required
          />
        </div>
      )}

      {/* Related Documents — only shown for documents: published documents CANNOT be selected; draft, review, and approval can be selected */}
      {isDocument && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-label-sm font-semibold text-on-surface-variant">
              Related Documents
            </label>
            <span className="text-[10px] text-on-surface-variant/50 font-medium bg-surface-container border border-outline-variant/40 px-1.5 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <p className="text-xs text-on-surface-variant/60 -mt-0.5">
            Link in-progress documents (Draft, In Review, In Approval) so they can be coordinated and published together. Published documents cannot be selected.
          </p>
          <MultiSearchableSelect
            values={selectedRelatedIds}
            onChange={(ids) => onChange('related_document_ids', ids)}
            options={relatedDocOptions}
            placeholder={
              relatedDocOptions.length === 0
                ? 'No draft, review, or approval documents available...'
                : 'Select related documents (draft, review, approval)...'
            }
            disabled={disabled || relatedDocOptions.length === 0}
          />
          {selectedRelatedIds.length > 0 && (
            <p className="text-xs text-blue-700 font-medium mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">sync</span>
              Synchronized publishing active — this document cannot be published until all selected related documents are also approved and published.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

BasicInfoTab.propTypes = {
  isDocument: PropTypes.bool,
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  templates: PropTypes.array,
  categories: PropTypes.array,
  departments: PropTypes.array,
  sites: PropTypes.array,
  disabled: PropTypes.bool,
  relatedDocumentCandidates: PropTypes.array,
  publishedDocuments: PropTypes.array,
};
