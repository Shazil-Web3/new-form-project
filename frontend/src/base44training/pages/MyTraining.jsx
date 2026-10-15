import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser, dueStatus, statusToneClasses, formatDate, addWeeks, toISODate, EXTENSION_WEEKS, MAX_EXTENSIONS } from '../lib/training';
import { Button } from '../components/ui/button';
import { downloadCertificate } from '../lib/certificate';
import { BookOpen, Award, Clock, CheckCircle2, AlertTriangle, FileText, Video, Radio, ListChecks, RefreshCw, ChevronRight, PlayCircle } from 'lucide-react';

const typeIcon = { pdf: FileText, on_demand_video: Video, live_class: Radio, linked_document: FileText };

export default function MyTraining() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState({});
  const [progress, setProgress] = useState({});
  const [certificates, setCertificates] = useState({});
  const [curriculumNames, setCurriculumNames] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      if (!me) { setLoading(false); return; }
      const myAssign = await base44.entities.Assignment.filter({ employee_id: me.id }, '-created_date', 100);
      setAssignments(myAssign);
      const allClasses = await base44.entities.Class.list();
      const classMap = {};
      for (const a of myAssign) {
        classMap[a.curriculum_id] = allClasses.filter((c) => c.curriculum_id === a.curriculum_id).sort((x, y) => (x.order || 0) - (y.order || 0));
      }
      setClasses(classMap);
      // Resolve current curriculum names so a rename is reflected here while
      // the assignment record keeps its original (possibly former) name.
      const allCurriculums = await base44.entities.Curriculum.list();
      const nameMap = {};
      (allCurriculums.items || allCurriculums).forEach((c) => { nameMap[c.id] = c.name; });
      setCurriculumNames(nameMap);
      const myProgress = await base44.entities.ClassProgress.filter({ employee_id: me.id }, '-updated_date', 200);
      const progMap = {};
      for (const p of myProgress) progMap[p.class_id] = p;
      setProgress(progMap);
      const myCerts = await base44.entities.Certificate.filter({ employee_id: me.id });
      const certMap = {};
      for (const c of myCerts) certMap[c.class_id] = c;
      setCertificates(certMap);
      setLoading(false);
    })();
  }, []);

  async function extendDueDate(a) {
    if (a.extensions_used >= MAX_EXTENSIONS) return;
    const newDate = toISODate(addWeeks(a.due_date, EXTENSION_WEEKS));
    await base44.entities.Assignment.update(a.id, { due_date: newDate, extensions_used: a.extensions_used + 1 });
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, due_date: newDate, extensions_used: x.extensions_used + 1 } : x)));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  const required = assignments.filter((a) => a.assignment_type === 'required');
  const electives = assignments.filter((a) => a.assignment_type === 'elective');

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Training</h1>
        <p className="text-sm text-slate-500">Complete your assigned training before the due date.</p>
      </div>

      <Section title="Required Training" icon={Clock} items={required} />
      <Section title="Electives" icon={BookOpen} items={electives} />

    </div>
  );

  function Section({ title, icon: Icon, items }) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Icon className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <span className="text-sm text-slate-400">({items.length})</span>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No {title.toLowerCase()} yet.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => {
              const ds = dueStatus(a.due_date, a.status);
              const allCurClasses = classes[a.curriculum_id] || [];
              const curClasses = a.class_id ? allCurClasses.filter((c) => c.id === a.class_id) : allCurClasses;
              const completedCount = curClasses.filter((c) => progress[c.id]?.status === 'completed').length;
              const pct = curClasses.length ? Math.round((completedCount / curClasses.length) * 100) : 0;
              const canExtend = a.assignment_type === 'elective' && a.status !== 'completed' && a.extensions_used < MAX_EXTENSIONS;
              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {(() => {
                        const currentName = curriculumNames[a.curriculum_id] || a.curriculum_name;
                        const renamed = currentName !== a.curriculum_name;
                        return (
                          <>
                            <p className="font-medium text-slate-900">{currentName}</p>
                            {renamed && (
                              <p className="mt-0.5 text-xs text-slate-400">formerly "{a.curriculum_name}"</p>
                            )}
                          </>
                        );
                      })()}
                      <p className="mt-0.5 text-xs text-slate-500">Due {formatDate(a.due_date)}{a.extensions_used > 0 && ` · Extended ${a.extensions_used}×`}</p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneClasses(ds.tone)}`}>{ds.label}</span>
                  </div>

                  {curClasses.length > 0 && (
                    <>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-slate-500">{completedCount} of {curClasses.length} completed</span>
                          <span className="font-medium text-slate-700">{pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {curClasses.map((c) => {
                          const p = progress[c.id];
                          const CIcon = typeIcon[c.content_type] || FileText;
                          const done = p?.status === 'completed';
                          return (
                            <Link
                              key={c.id}
                              to={`/training/class/${c.id}`}
                              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/50"
                            >
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>
                                {done ? <CheckCircle2 className="h-4 w-4" /> : <CIcon className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900">{c.title}</p>
                                <p className="text-xs text-slate-400">
                                  {c.content_type === 'pdf' ? 'PDF' : c.content_type === 'on_demand_video' ? 'Video' : c.content_type === 'linked_document' ? 'Linked document' : 'Live class'}
                                  {c.has_quiz && ' · Quiz'}
                                </p>
                              </div>
                              {done && certificates[c.id] && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadCertificate(certificates[c.id].employee_name || user?.full_name || 'Certificate holder', c.title, certificates[c.id]); }}
                                  className="mr-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                  <Award className="h-3.5 w-3.5" /> Certificate
                                </button>
                              )}
                              {done ? (
                                <span className="text-xs font-medium text-emerald-600">Done</span>
                              ) : (
                                <PlayCircle className="h-5 w-5 text-indigo-500" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {canExtend && (
                    <button onClick={() => extendDueDate(a)} className="mt-4 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                      <RefreshCw className="h-3.5 w-3.5" /> Extend due date ({MAX_EXTENSIONS - a.extensions_used} left)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}