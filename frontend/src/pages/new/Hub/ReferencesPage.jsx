/**
 * @file ReferencesPage.jsx
 * @description Dedicated References and Cross-Document Linking Hub Page
 * @dependencies react, react-router-dom, MainLayout, getReferences, syncHistoricalReferences
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import { useAuth } from '../../../utils/authService';
import { getReferences, syncHistoricalReferences } from '../../../api/references';

const STATUS_CONFIG = {
  draft: { label: 'Draft', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_review: { label: 'In Review', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  reviewed: { label: 'Reviewed', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  pending_revision: { label: 'In Revision', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  revised: { label: 'Revised', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  pending_approval: { label: 'In Approval', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  approved: { label: 'Approved', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  published: { label: 'Published', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  archived: { label: 'Archived', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending_archive_approval: { label: 'Archive Approval', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  old: { label: 'Archived', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const getStatusBadge = (status) => {
  const s = String(status || '').toLowerCase();
  return STATUS_CONFIG[s] || { label: status || 'Unknown', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
};

export default function ReferencesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [references, setReferences] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [roleScope, setRoleScope] = useState('user');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [scopeType, setScopeType] = useState('all'); // 'all' | 'documents' | 'templates'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [selectedReference, setSelectedReference] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const isAdmin = user?.role === 'admin' || user?.role === 'project_manager' || user?.role === 'superadmin';

  // Fetch references from backend
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getReferences();
      if (res?.success) {
        setReferences(res.data || []);
        setMetrics(res.metrics || null);
        setRoleScope(isAdmin ? 'admin' : (res.roleScope || 'user'));
      }
    } catch (err) {
      console.error('Failed to load references:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle re-index sync
  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncHistoricalReferences();
      await loadData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Filtered references
  const filteredReferences = useMemo(() => {
    let list = [...references];

    // 1. Filter by scopeType
    if (scopeType === 'documents') {
      list = list.filter((r) => r.sourceType === 'document');
    } else if (scopeType === 'templates') {
      list = list.filter((r) => r.sourceType === 'template');
    }

    // 2. Filter by search query
    if (searchVal.trim()) {
      const q = searchVal.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.sourceTitle || '').toLowerCase().includes(q) ||
          (r.targetTitle || '').toLowerCase().includes(q) ||
          (r.sourceAuthor || '').toLowerCase().includes(q) ||
          (r.targetAuthor || '').toLowerCase().includes(q) ||
          String(r.sourceId).toLowerCase().includes(q) ||
          String(r.targetId).toLowerCase().includes(q)
      );
    }

    return list;
  }, [references, scopeType, searchVal]);

  // Pagination calculation
  const totalItems = filteredReferences.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReferences.slice(start, start + pageSize);
  }, [filteredReferences, currentPage, pageSize]);

  // Navigation handlers
  const handleOpenSource = (ref) => {
    if (ref.sourceType === 'template') {
      navigate(`/template/${ref.sourceId}`);
    } else {
      navigate(`/document/${ref.sourceId}`);
    }
  };

  const handleOpenTarget = (ref) => {
    window.open(`/document/${ref.targetId}?view=reference`, '_blank');
  };

  return (
    <MainLayout
      showSearch={false}
      searchVal={searchVal}
      onSearchChange={(val) => {
        setSearchVal(val);
        setCurrentPage(1);
      }}
    >
      <div className="max-w-container_max_width mx-auto space-y-6">
        
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">library_books</span>
              </span>
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2.5">
                  References & Citations
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                      roleScope === 'admin'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {roleScope === 'admin' ? 'Organization Scope' : 'My Workspace'}
                  </span>
                </h1>
                <p className="text-xs text-on-surface-variant/80 mt-0.5">
                  Track cross-document links, mentions (@), and template references across your documents.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface transition-all shadow-sm disabled:opacity-50"
              title="Rescan documents and templates to refresh cross-references"
            >
              <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{syncing ? 'Re-indexing...' : 'Refresh References'}</span>
            </button>
          </div>
        </div>

        {/* High-Impact Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 select-none">
          {/* Total References */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/40 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">link</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">Total References</p>
              <h3 className="text-2xl font-black text-on-surface mt-0.5">
                {metrics?.totalReferences ?? references.length}
              </h3>
            </div>
          </div>

          {/* Referencing Documents */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/40 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">feed</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">Referencing Docs</p>
              <h3 className="text-2xl font-black text-on-surface mt-0.5">
                {metrics?.referencingDocuments ?? 0}
              </h3>
            </div>
          </div>

          {/* Referencing Templates */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/40 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">assignment</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">Referencing Templates</p>
              <h3 className="text-2xl font-black text-on-surface mt-0.5">
                {metrics?.referencingTemplates ?? 0}
              </h3>
            </div>
          </div>
        </div>

        {/* Scope Selector & Quick Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/40 shadow-sm">
          {/* Scope Buttons */}
          <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 select-none">
            {[
              { id: 'all', label: 'All Items', icon: 'all_inclusive' },
              { id: 'documents', label: 'Documents', icon: 'feed' },
              { id: 'templates', label: 'Templates', icon: 'assignment' }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setScopeType(type.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scopeType === type.id
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>

          {/* Search bar & View Toggle */}
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-72">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant/50 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search reference or target..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-all placeholder:text-on-surface-variant/40"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                  viewMode === 'table' ? 'bg-white shadow-sm text-blue-700' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Table View"
              >
                <span className="material-symbols-outlined text-[18px]">table_chart</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                  viewMode === 'grid' ? 'bg-white shadow-sm text-blue-700' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Grid View"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
            </div>
          </div>
        </div>
        {/* Main Content Area */}
        {loading ? (
          <div className="py-24 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/40">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full mb-3" />
            <p className="text-xs font-semibold text-on-surface-variant">Loading references and dependencies...</p>
          </div>
        ) : filteredReferences.length === 0 ? (
          <div className="py-20 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/40 px-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-high mx-auto flex items-center justify-center mb-3 text-on-surface-variant/50">
              <span className="material-symbols-outlined text-[32px]">link_off</span>
            </div>
            <h3 className="text-base font-bold text-on-surface">No references found</h3>
            <p className="text-xs text-on-surface-variant/70 max-w-md mx-auto mt-1 mb-4">
              {searchVal
                ? `No references matched "${searchVal}". Try adjusting your search query.`
                : 'No cross-document references have been established yet. Mention a published document using @ in the text editor to create a reference.'}
            </p>
            {searchVal && (
              <button
                onClick={() => setSearchVal('')}
                className="px-3.5 py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-xs font-bold text-on-surface transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 border-b border-outline-variant/40 text-on-surface-variant uppercase tracking-wider text-[11px] font-bold select-none">
                    <th className="py-3 px-4">Referencing Item (Source)</th>
                    <th className="py-3 px-4 text-center">Relation</th>
                    <th className="py-3 px-4">Referenced Document (Target)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {paginatedList.map((ref) => {
                    const sourceBadge = getStatusBadge(ref.sourceStatus);
                    const targetBadge = getStatusBadge(ref.targetStatus);
                    const isTemplate = ref.sourceType === 'template';

                    return (
                      <tr key={ref.id} className="hover:bg-surface-container-low/40 transition-colors">
                        {/* Source Item */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isTemplate ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              }`}
                              title={isTemplate ? 'Template' : 'Document'}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {isTemplate ? 'assignment' : 'feed'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => handleOpenSource(ref)}
                                  className="font-bold text-on-surface hover:text-blue-700 transition-colors text-[13px] text-left line-clamp-1"
                                  title="Open in editor"
                                >
                                  {ref.sourceTitle}
                                </button>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${sourceBadge.badge}`}
                                >
                                  {sourceBadge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-on-surface-variant/70">
                                <span className="bg-surface-container-high px-1.5 py-0.2 rounded shrink-0">
                                  v{ref.sourceVersion || '1.0'}
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-[140px]" title={ref.sourceAuthor}>
                                  By {ref.sourceAuthor}
                                </span>
                                {ref.sourceDepartment && (
                                  <>
                                    <span>•</span>
                                    <span className="text-on-surface-variant/60">{ref.sourceDepartment}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Connection Arrow & Tag */}
                        <td className="py-3.5 px-4 text-center select-none">
                          <div className="inline-flex flex-col items-center">
                            <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 mb-1">
                              references
                            </span>
                            <span className="material-symbols-outlined text-blue-700/60 text-[18px]">
                              arrow_forward
                            </span>
                          </div>
                        </td>

                        {/* Target Document */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-[18px]">bookmark</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => handleOpenTarget(ref)}
                                  className="font-bold text-on-surface hover:text-emerald-700 transition-colors text-[13px] text-left line-clamp-1"
                                  title="View published document in reference mode"
                                >
                                  {ref.targetTitle}
                                </button>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${targetBadge.badge}`}
                                >
                                  {targetBadge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-on-surface-variant/70">
                                <span className="bg-surface-container-high px-1.5 py-0.2 rounded shrink-0">
                                  v{ref.targetVersion || '1.0'}
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-[140px]" title={ref.targetAuthor}>
                                  By {ref.targetAuthor}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenSource(ref)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1"
                              title="Open referencing item in editor"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              <span>Open Source</span>
                            </button>
                            <button
                              onClick={() => setSelectedReference(ref)}
                              className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors"
                              title="Inspect Reference Connection"
                            >
                              <span className="material-symbols-outlined text-[16px]">info</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedList.map((ref) => {
              const sourceBadge = getStatusBadge(ref.sourceStatus);
              const targetBadge = getStatusBadge(ref.targetStatus);
              const isTemplate = ref.sourceType === 'template';

              return (
                <div
                  key={ref.id}
                  className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/40 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Source Box */}
                    <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/30">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant/70 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">
                            {isTemplate ? 'assignment' : 'feed'}
                          </span>
                          Referencing {isTemplate ? 'Template' : 'Document'}
                        </span>
                        <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold border uppercase ${sourceBadge.badge}`}>
                          {sourceBadge.label}
                        </span>
                      </div>
                      <h4
                        onClick={() => handleOpenSource(ref)}
                        className="font-bold text-on-surface text-sm hover:text-blue-700 cursor-pointer line-clamp-1"
                      >
                        {ref.sourceTitle}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-on-surface-variant/60">
                        <span>v{ref.sourceVersion || '1.0'}</span>
                        <span>•</span>
                        <span>{ref.sourceAuthor}</span>
                      </div>
                    </div>

                    {/* Connection bridge */}
                    <div className="flex items-center justify-center gap-2 py-0.5 text-blue-700">
                      <div className="h-px flex-1 bg-outline-variant/40" />
                      <span className="text-[10px] font-mono font-extrabold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">link</span>
                        references
                      </span>
                      <div className="h-px flex-1 bg-outline-variant/40" />
                    </div>

                    {/* Target Box */}
                    <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/60">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800/70 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">bookmark</span>
                          Referenced Published Document
                        </span>
                        <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold border uppercase ${targetBadge.badge}`}>
                          {targetBadge.label}
                        </span>
                      </div>
                      <h4
                        onClick={() => handleOpenTarget(ref)}
                        className="font-bold text-on-surface text-sm hover:text-emerald-700 cursor-pointer line-clamp-1"
                      >
                        {ref.targetTitle}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-on-surface-variant/60">
                        <span>v{ref.targetVersion || '1.0'}</span>
                        <span>•</span>
                        <span>{ref.targetAuthor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedReference(ref)}
                      className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      <span>Details</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenSource(ref)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold"
                      >
                        Open Source
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30 select-none">
            <span className="text-xs text-on-surface-variant">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} references
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentPage(num)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold ${
                    currentPage === num
                      ? 'bg-blue-700 text-white'
                      : 'text-on-surface hover:bg-surface-container border border-outline-variant/40'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}

        {/* Connection Details Inspection Modal */}
        {selectedReference && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-700 text-[22px]">link</span>
                  <h3 className="font-bold text-base text-on-surface">Reference Connection Details</h3>
                </div>
                <button
                  onClick={() => setSelectedReference(null)}
                  className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Referencing Source Details */}
                <div className="p-4 bg-surface-container-low/50 rounded-xl border border-outline-variant/30 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant/70">
                    Source ({selectedReference.sourceType})
                  </span>
                  <h4 className="font-bold text-sm text-on-surface">{selectedReference.sourceTitle}</h4>
                  <div className="text-xs space-y-1 text-on-surface-variant/80 font-mono">
                    <p>Status: <span className="font-bold text-on-surface">{selectedReference.sourceStatus}</span></p>
                    <p>Version: v{selectedReference.sourceVersion || '1.0'}</p>
                    <p>Author: {selectedReference.sourceAuthor}</p>
                    {selectedReference.sourceDepartment && <p>Dept: {selectedReference.sourceDepartment}</p>}
                    <p className="text-[10px] text-on-surface-variant/50">ID: {selectedReference.sourceId}</p>
                  </div>
                  <button
                    onClick={() => {
                      handleOpenSource(selectedReference);
                      setSelectedReference(null);
                    }}
                    className="w-full mt-2 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Open in Editor
                  </button>
                </div>

                {/* Referenced Target Details */}
                <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100/60 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800/70">
                    Referenced Document
                  </span>
                  <h4 className="font-bold text-sm text-on-surface">{selectedReference.targetTitle}</h4>
                  <div className="text-xs space-y-1 text-on-surface-variant/80 font-mono">
                    <p>Status: <span className="font-bold text-on-surface">{selectedReference.targetStatus}</span></p>
                    <p>Version: v{selectedReference.targetVersion || '1.0'}</p>
                    <p>Author: {selectedReference.targetAuthor}</p>
                    <p className="text-[10px] text-on-surface-variant/50">ID: {selectedReference.targetId}</p>
                  </div>
                  <button
                    onClick={() => {
                      handleOpenTarget(selectedReference);
                      setSelectedReference(null);
                    }}
                    className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Open Reference View
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedReference(null)}
                  className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
