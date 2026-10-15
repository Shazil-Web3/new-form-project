import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import { Download, LoaderCircle, Search, Sparkles, Star, TrendingUp, X } from 'lucide-react';
import { getTrendingItems, toggleTrendingFavorite } from '../../../api/trending';
import { sanitizeCsvCell } from '../../../utils/csvUtils';

const statusClasses = {
  Draft: 'bg-slate-100 text-slate-700',
  'In Review': 'bg-sky-100 text-sky-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function TrendingPage() {
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showPeopleMenu, setShowPeopleMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    const loadTrending = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await getTrendingItems({
          search: searchTerm,
          type: typeFilter,
          team: selectedPeople.join(','),
          status: statusFilter === 'All' ? '' : statusFilter,
          favoritesOnly,
        });
        const items = response?.data || [];
        setRows(items.map((row) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          templateName: row.type === 'Template' ? 'Workspace template' : 'Document workflow',
          members: (row.teamMembers || []).map((member) => ({
            name: member.name,
            initials: member.initials || 'U',
            color: member.color || 'bg-slate-600',
          })),
          date: row.timestamp,
          status: row.status,
          favorite: Boolean(row.is_favorite),
          stages: {
            Draft: row.stageDurations?.draft || '0 minutes',
            Review: row.stageDurations?.review || '0 minutes',
            Approval: row.stageDurations?.approval || '0 minutes',
          },
        })));
      } catch (err) {
        console.error('Failed to load trending items', err);
        setError('Unable to load trending workflow data right now.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadTrending();
  }, [favoritesOnly, searchTerm, selectedPeople, statusFilter, typeFilter]);

  const peopleOptions = useMemo(() => {
    const names = new Set();
    rows.forEach((row) => {
      row.members.forEach((member) => names.add(member.name));
    });
    return Array.from(names);
  }, [rows]);

  const totals = useMemo(() => {
    const totalTracked = rows.length;
    const favoriteCount = rows.filter((row) => row.favorite).length;
    const activeInReview = rows.filter((row) => row.status === 'In Review').length;

    return { totalTracked, favoriteCount, activeInReview };
  }, [rows]);

  const toggleFavorite = async (row) => {
    try {
      const response = await toggleTrendingFavorite({ itemType: row.type === 'Template' ? 'template' : 'document', itemId: row.id });
      const nextFavorite = Boolean(response?.data?.is_favorite);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, favorite: nextFavorite } : item));
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      setError('Unable to update the favorite pin right now.');
    }
  };

  const togglePerson = (name) => {
    setSelectedPeople((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedPeople([]);
    setStatusFilter('All');
    setTypeFilter('All');
    setFavoritesOnly(false);
    setShowPeopleMenu(false);
  };

  const exportCsv = () => {
    const columns = ['Document Name', 'Type', 'Team', 'Date', 'Status', 'Stage Duration'];
    const rowsCsv = rows.map((row) => {
      const memberNames = row.members.map((member) => member.name).join(' | ');
      const stageSummary = Object.entries(row.stages).map(([stage, value]) => `${stage}: ${value}`).join(' • ');
      return [row.title, row.type, memberNames, formatDate(row.date), row.status, stageSummary]
        .map(sanitizeCsvCell)
        .join(',');
    });

    const csv = [columns.join(','), ...rowsCsv].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'trending_workflows.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <MainLayout showSearch={false}>
      <div className="max-w-container_max_width mx-auto pb-8">
        <div className="mb-6 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                <TrendingUp size={14} />
                Workflow Insights
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-on-surface">Trending</h2>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Track and analyze document workflows, team engagement, duration, and status across your workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
              <div className="rounded-full bg-surface-container-high px-3 py-2">Total Tracked: {totals.totalTracked}</div>
              <div className="rounded-full bg-surface-container-high px-3 py-2">Favorites: {totals.favoriteCount}</div>
              <div className="rounded-full bg-surface-container-high px-3 py-2">In Review: {totals.activeInReview}</div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-outline-variant bg-background/70 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <label className="flex flex-1 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant shadow-sm">
                  <Search size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search documents or templates"
                    className="w-full border-none bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                  />
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPeopleMenu((value) => !value)}
                    className="flex min-w-[220px] items-center justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface shadow-sm"
                  >
                    <span>{selectedPeople.length ? `${selectedPeople.length} selected` : 'People / Team'}</span>
                    <Sparkles size={16} className="text-on-surface-variant" />
                  </button>

                  {showPeopleMenu && (
                    <div className="absolute z-20 mt-2 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        <span>Assigned team</span>
                        <button type="button" onClick={() => setShowPeopleMenu(false)} className="rounded-full p-1 hover:bg-surface-container-high">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {peopleOptions.map((person) => {
                          const checked = selectedPeople.includes(person);
                          return (
                            <label key={person} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-on-surface hover:bg-surface-container-high">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerson(person)}
                                className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                              />
                              <span>{person}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <label className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface shadow-sm">
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="bg-transparent text-sm text-on-surface outline-none"
                  >
                    <option value="All">All Types</option>
                    <option value="Template">Template</option>
                    <option value="Draft">Draft</option>
                  </select>
                </label>

                <label className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface shadow-sm">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="bg-transparent text-sm text-on-surface outline-none"
                  >
                    <option value="All">All Status</option>
                    <option value="Draft">Draft</option>
                    <option value="In Review">In Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFavoritesOnly((value) => !value)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${favoritesOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}
                >
                  {favoritesOnly ? 'Showing Favorites' : 'Favorites'}
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-background px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-2xl border border-outline-variant bg-background px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-14 text-sm text-on-surface-variant">
              <LoaderCircle className="animate-spin" size={18} />
              Loading workflow insights...
            </div>
          ) : error ? (
            <div className="px-6 py-14 text-center text-sm text-red-600">{error}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-outline-variant">
                  <thead className="bg-surface-container-high">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                      <th className="px-4 py-3">Favorite</th>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Stage Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
                    {rows.map((row) => (
                      <tr key={row.id} className="transition hover:bg-surface-container-high/60">
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(row)}
                            className="rounded-full p-2 transition hover:scale-110"
                            aria-label={`Toggle favorite for ${row.title}`}
                          >
                            <Star
                              size={18}
                              className={row.favorite ? 'fill-amber-400 text-amber-400 animate-pulse' : 'text-slate-400'}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-on-surface">{row.title}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.type === 'Template' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                {row.type}
                              </span>
                            </div>
                            <span className="text-sm text-on-surface-variant">{row.templateName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.members.map((member) => (
                              <div key={member.name} className="flex items-center gap-2 rounded-full border border-outline-variant bg-background px-2.5 py-1.5">
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${member.color}`}>
                                  {member.initials}
                                </span>
                                <span className="text-sm text-on-surface">{member.name}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-on-surface-variant">{formatDate(row.date)}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[row.status] || 'bg-slate-100 text-slate-700'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                            {Object.entries(row.stages).map(([stage, value]) => (
                              <span key={stage} className="rounded-full bg-surface-container-high px-2.5 py-1.5">
                                {stage}: {value}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-on-surface-variant">
                  No workflows match the current filters. Try adjusting the search or team selection.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
