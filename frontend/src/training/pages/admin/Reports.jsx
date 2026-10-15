import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { EmptyState, PageHeader } from '../../components/common';
import { trainingService } from '../../store';
import { ui } from '../../theme';

const STATUS_LABEL = { completed: 'Completed', in_progress: 'In progress', not_started: 'Not started' };

const formatDuration = (seconds) => {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
};

const REPORT_COLUMNS = [
  { key: 'employee', label: 'Employee', width: 34 },
  { key: 'manager', label: 'Manager', width: 30 },
  { key: 'curriculum', label: 'Curriculum', width: 36 },
  { key: 'class_title', label: 'Class', width: 40 },
  { key: 'status', label: 'Status', width: 22, format: (row) => STATUS_LABEL[row.status] },
  { key: 'completed_date', label: 'Completed', width: 22, format: (row) => row.completed_date || '—' },
  { key: 'quiz_score', label: 'Quiz', width: 16, format: (row) => (row.attempts > 0 ? `${row.quiz_score}% ${row.quiz_passed ? 'Pass' : 'Fail'}` : '—') },
  { key: 'attempts', label: 'Attempts', width: 18 },
  { key: 'time_spent_seconds', label: 'Time spent', width: 22, format: (row) => formatDuration(row.time_spent_seconds) },
  { key: 'rating', label: 'Rating', width: 16, format: (row) => (row.rating ? `${row.rating}/5` : '—') },
];

const cellText = (column, row) => String(column.format ? column.format(row) : row[column.key] ?? '');

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(report) {
  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    REPORT_COLUMNS.map((column) => escape(column.label)).join(','),
    ...report.rows.map((row) => REPORT_COLUMNS.map((column) => escape(cellText(column, row))).join(',')),
  ];
  downloadBlob(`training-report-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
}

async function exportPdf(report) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { summary } = report;
  const left = 10;
  let y = 14;

  doc.setFontSize(16);
  doc.text('Training Compliance Report', left, y);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, left, (y += 6));
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(
    `Completion rate ${summary.completion_rate}% (${summary.completed}/${summary.total_assignments})   |   Quiz pass rate ${summary.pass_rate}% (${summary.passed} passed, ${summary.failed} failed)   |   Avg time ${formatDuration(summary.avg_time_seconds)}`,
    left,
    (y += 7)
  );
  y += 7;

  const drawHeader = () => {
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    let x = left;
    REPORT_COLUMNS.forEach((column) => {
      doc.text(column.label, x, y);
      x += column.width;
    });
    doc.setFont(undefined, 'normal');
    doc.line(left, y + 1.5, left + REPORT_COLUMNS.reduce((sum, column) => sum + column.width, 0), y + 1.5);
    y += 6;
  };
  drawHeader();

  report.rows.forEach((row) => {
    if (y > 195) {
      doc.addPage();
      y = 14;
      drawHeader();
    }
    let x = left;
    REPORT_COLUMNS.forEach((column) => {
      const maxChars = Math.floor(column.width / 1.9);
      const text = cellText(column, row);
      doc.text(text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text, x, y);
      x += column.width;
    });
    y += 5;
  });

  doc.save(`training-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function StatCard({ label, value, hint }) {
  return (
    <div className={`${ui.card} p-5`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function DataTable({ columns, rows, empty }) {
  if (rows.length === 0) return <div className="px-4 py-8 text-center text-sm text-slate-400">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column.label} className="whitespace-nowrap px-4 py-2.5">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.label} className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const statusBadge = (status) => {
  const tone = { completed: 'bg-emerald-50 text-emerald-700', in_progress: 'bg-amber-50 text-amber-700', not_started: 'bg-slate-100 text-slate-600' }[status];
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{STATUS_LABEL[status]}</span>;
};

export default function Reports() {
  const [filters, setFilters] = useState({ managerId: '', employeeId: '', status: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await trainingService.fetchReport(filters));
    } catch (error) {
      message.error(error?.response?.data?.error || 'Could not load the report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch) => setFilters((current) => ({ ...current, ...patch }));

  const runExport = async (kind) => {
    setExporting(true);
    try {
      if (kind === 'csv') exportCsv(report);
      else await exportPdf(report);
    } catch (error) {
      message.error('Could not create the export');
    } finally {
      setExporting(false);
    }
  };

  const summary = report?.summary;

  return (
    <div className={ui.page}>
      <PageHeader title="Reports" subtitle="Compliance audit, exports and learning analytics." />

      <div className={`${ui.card} mt-6 flex flex-wrap items-end gap-4 p-4`}>
        {report?.managers?.length ? (
          <label className="text-xs font-semibold text-slate-500">
            Manager
            <select className={`${ui.input} mt-1 w-48`} value={filters.managerId} onChange={(event) => set({ managerId: event.target.value, employeeId: '' })}>
              <option value="">All managers</option>
              {report.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-xs font-semibold text-slate-500">
          Employee
          <select className={`${ui.input} mt-1 w-48`} value={filters.employeeId} onChange={(event) => set({ employeeId: event.target.value })}>
            <option value="">All employees</option>
            {(report?.people || []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Completion status
          <select className={`${ui.input} mt-1 w-44`} value={filters.status} onChange={(event) => set({ status: event.target.value })}>
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In progress</option>
            <option value="not_started">Not started</option>
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={ui.btnLight} disabled={!report || exporting} onClick={() => runExport('csv')}>
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Download CSV
          </button>
          <button type="button" className={ui.btnDark} disabled={!report || exporting} onClick={() => runExport('pdf')}>
            <span className="material-symbols-outlined text-[18px]">fact_check</span>
            Compliance audit (PDF)
          </button>
        </div>
      </div>

      {loading && !report ? <div className="mt-8 text-sm text-slate-400">Loading report…</div> : null}

      {summary ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Completion rate" value={`${summary.completion_rate}%`} hint={`${summary.completed} of ${summary.total_assignments} classes completed`} />
            <StatCard label="Quiz pass rate" value={summary.quizzes_taken ? `${summary.pass_rate}%` : '—'} hint={`${summary.passed} passed · ${summary.failed} failed`} />
            <StatCard label="Avg time per class" value={formatDuration(summary.avg_time_seconds)} hint={`${formatDuration(summary.total_time_seconds)} total logged`} />
            <StatCard label="Avg satisfaction" value={summary.avg_rating ? `${summary.avg_rating}/5` : '—'} hint={`${summary.rating_count} rating${summary.rating_count === 1 ? '' : 's'}`} />
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">Compliance detail</h2>
          <div className={`${ui.card} overflow-hidden`}>
            <DataTable
              empty="No assignments match these filters."
              rows={report.rows}
              columns={[
                { label: 'Employee', render: (row) => <span className="font-medium text-slate-900">{row.employee}</span> },
                { label: 'Manager', render: (row) => row.manager || '—' },
                { label: 'Curriculum', render: (row) => row.curriculum },
                { label: 'Class', render: (row) => row.class_title },
                { label: 'Status', render: (row) => statusBadge(row.status) },
                { label: 'Completed', render: (row) => row.completed_date || '—' },
                { label: 'Quiz', render: (row) => (row.attempts > 0 ? `${row.quiz_score}% · ${row.quiz_passed ? 'Pass' : 'Fail'}` : '—') },
                { label: 'Attempts', render: (row) => row.attempts },
                { label: 'Time spent', render: (row) => formatDuration(row.time_spent_seconds) },
                { label: 'Rating', render: (row) => (row.rating ? `${row.rating}/5` : '—') },
              ]}
            />
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">Where learners get stuck</h2>
          <div className={`${ui.card} overflow-hidden`}>
            <DataTable
              empty="No class activity yet."
              rows={report.classStats}
              columns={[
                { label: 'Class', render: (row) => <span className="font-medium text-slate-900">{row.class_title}</span> },
                { label: 'Curriculum', render: (row) => row.curriculum },
                { label: 'Assigned', render: (row) => row.assigned },
                { label: 'Completed', render: (row) => row.completed },
                { label: 'Stuck (in progress)', render: (row) => `${row.in_progress} · ${row.stuck_rate}%` },
                { label: 'Avg attempts', render: (row) => row.avg_attempts },
                { label: 'Avg time', render: (row) => formatDuration(row.avg_time_seconds) },
                { label: 'Satisfaction', render: (row) => (row.avg_rating ? `${row.avg_rating}/5` : '—') },
              ]}
            />
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">Quiz questions learners miss or skip</h2>
          <div className={`${ui.card} mb-8 overflow-hidden`}>
            <DataTable
              empty="No quiz attempts yet."
              rows={report.questionStats}
              columns={[
                { label: 'Question', render: (row) => <span className="block max-w-md truncate font-medium text-slate-900" title={row.question}>{row.question}</span> },
                { label: 'Class', render: (row) => row.class_title },
                { label: 'Answered', render: (row) => row.answered },
                { label: 'Wrong rate', render: (row) => `${row.wrong_rate}%` },
                { label: 'Skipped / timed out', render: (row) => `${row.skip_rate}%` },
              ]}
            />
          </div>
        </>
      ) : null}

      {!loading && !report ? <EmptyState icon="assessment" message="The report could not be loaded." /> : null}
    </div>
  );
}
