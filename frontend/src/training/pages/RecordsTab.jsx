import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { downloadCertificate } from '../certificate';
import { EmptyState, PageHeader } from '../components/common';
import { useTrainingContext } from '../context';
import { trainingService } from '../store';
import { ui } from '../theme';

export default function RecordsTab() {
  const { role } = useTrainingContext();
  const [scope, setScope] = useState('mine');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    trainingService
      .fetchRecords(role === 'manager' ? { scope: scope === 'all' ? 'all' : undefined } : {})
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((error) => {
        if (!cancelled) message.error(error?.response?.data?.error || 'Could not load records');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, scope]);

  const query = search.trim().toLowerCase();
  const filtered = (records || []).filter(
    (record) => !query || record.employee.toLowerCase().includes(query) || record.class_name.toLowerCase().includes(query)
  );
  const showEmployee = role !== 'employee';

  return (
    <div className={ui.page}>
      <PageHeader
        title="Records"
        subtitle={role === 'employee' ? 'Your completed classes.' : 'Completed classes and certificate status.'}
      />

      <div className={`${ui.card} mt-6 flex flex-wrap items-center gap-3 p-4`}>
        {role === 'manager' ? (
          <div className="flex rounded-lg border border-slate-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`rounded-md px-3 py-1.5 font-medium ${scope === 'mine' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              My team
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded-md px-3 py-1.5 font-medium ${scope === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              Everyone
            </button>
          </div>
        ) : null}
        {showEmployee ? (
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by employee or class…"
            className={`${ui.input} max-w-xs`}
            aria-label="Search records"
          />
        ) : null}
      </div>

      <div className={`${ui.card} mt-4 overflow-hidden`}>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                {showEmployee ? <th className="px-4 py-2.5">Employee</th> : null}
                <th className="px-4 py-2.5">Class Name</th>
                <th className="px-4 py-2.5">Class ID</th>
                <th className="px-4 py-2.5">Date Complete</th>
                <th className="px-4 py-2.5">Active</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => (
                <tr key={`${record.employee_id}-${record.class_id}`} className="hover:bg-slate-50">
                  {showEmployee ? <td className="px-4 py-2.5 font-medium text-slate-900">{record.employee}</td> : null}
                  <td className="px-4 py-2.5 text-slate-700">{record.class_name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{record.class_id}</td>
                  <td className="px-4 py-2.5 text-slate-500">{record.date_complete || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${record.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {record.active ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {record.certificate ? (
                      <button
                        type="button"
                        onClick={() => downloadCertificate(record.employee || 'Certificate holder', record.class_name, record.certificate)}
                        className={ui.link}
                      >
                        <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
                        Certificate
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 ? <EmptyState icon="badge" message="No completed classes yet." /> : null}
      </div>
    </div>
  );
}
