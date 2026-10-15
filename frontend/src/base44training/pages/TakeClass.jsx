import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser, formatDateTime } from '../lib/training';
import { Button } from '../components/ui/button';
import { downloadCertificate } from '../lib/certificate';
import { Award, Star, ArrowLeft, FileText, Video, Radio, ListChecks, CheckCircle2, ExternalLink, Clock } from 'lucide-react';
import ClassVideo from '../components/ClassVideo';
import LinkedDocumentView from '../components/LinkedDocumentView';

export default function TakeClass() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cls, setCls] = useState(null);
  const [progress, setProgress] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [rating, setRating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const c = await base44.entities.Class.get(classId);
      setCls(c);
      if (me) {
        const existing = await base44.entities.ClassProgress.filter({ employee_id: me.id, class_id: classId });
        if (existing.length > 0) {
          setProgress(existing[0]);
          if (existing[0].status !== 'completed') {
            const updated = await base44.entities.ClassProgress.update(existing[0].id, { status: 'in_progress', progress_percent: 50 });
            setProgress(updated);
          }
        } else {
          const created = await base44.entities.ClassProgress.create({
            employee_id: me.id,
            class_id: classId,
            class_name: c.title,
            curriculum_id: c.curriculum_id,
            status: 'in_progress',
            progress_percent: 50,
          });
          setProgress(created);
        }
      }
      if (me) await loadExtras(me.id);
      setLoading(false);
    })();
  }, [classId]);

  // Time-spent log: while this page is open and visible, report elapsed seconds every 30s (and once on leaving).
  const lastBeat = useRef(Date.now());
  useEffect(() => {
    if (!progress) return undefined;
    lastBeat.current = Date.now();
    const flush = () => {
      const seconds = Math.round((Date.now() - lastBeat.current) / 1000);
      lastBeat.current = Date.now();
      if (seconds > 0 && document.visibilityState === 'visible') base44.classes.logTime(classId, seconds).catch(() => {});
    };
    const timer = setInterval(flush, 30000);
    return () => { clearInterval(timer); flush(); };
  }, [Boolean(progress), classId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExtras(employeeId) {
    const certs = await base44.entities.Certificate.filter({ employee_id: employeeId, class_id: classId });
    setCertificate(certs[0] || null);
    const ratings = await base44.entities.ClassRating.filter({ employee_id: employeeId, class_id: classId });
    setRating(ratings[0]?.rating ?? null);
  }

  async function rate(value) {
    await base44.classes.rate(classId, value);
    setRating(value);
  }

  async function markComplete() {
    if (!progress) return;
    const updated = await base44.entities.ClassProgress.update(progress.id, {
      status: 'completed',
      progress_percent: 100,
      completed_date: new Date().toISOString().split('T')[0],
    });
    setProgress(updated);
    if (user) await loadExtras(user.id);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (!cls) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Class not found.</div>;
  }

  const done = progress?.status === 'completed';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <ContentTypeBadge type={cls.content_type} />
          {done && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 className="h-3 w-3" /> Completed</span>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{cls.title}</h1>
        {cls.description && <p className="mt-1 text-sm text-slate-500">{cls.description}</p>}
        {cls.duration_minutes > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" /> {cls.duration_minutes} minutes</p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {cls.content_type === 'pdf' && cls.content_url && (
          <iframe src={cls.content_url} title={cls.title} className="h-[70vh] w-full" />
        )}
        {cls.content_type === 'on_demand_video' && cls.content_url && (
          <ClassVideo url={cls.content_url} title={cls.title} />
        )}
        {cls.content_type === 'linked_document' && (
          <LinkedDocumentView documentId={cls.document_id} fallbackTitle={cls.document_title} />
        )}
        {cls.content_type === 'live_class' && (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Radio className="h-8 w-8" />
            </div>
            <p className="text-sm text-slate-500">Live session scheduled for</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatDateTime(cls.live_class_date)}</p>
            {cls.live_class_link && (
              <a href={cls.live_class_link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex">
                <Button><ExternalLink className="mr-1.5 h-4 w-4" /> Join live class</Button>
              </a>
            )}
          </div>
        )}
        {!cls.content_url && cls.content_type !== 'live_class' && cls.content_type !== 'linked_document' && (
          <div className="p-12 text-center text-sm text-slate-400">No content uploaded for this class yet.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {cls.has_quiz ? (
          <Link to={`/training/quiz/${cls.id}`}>
            <Button size="lg" variant={done ? 'outline' : 'default'}>
              <ListChecks className="mr-1.5 h-4 w-4" /> {done ? 'Retake Quiz' : 'Take Quiz'}
            </Button>
          </Link>
        ) : (
          <Button onClick={markComplete} disabled={done} size="lg">
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> {done ? 'Completed' : 'Mark as Complete'}
          </Button>
        )}
      </div>

      {done && (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {certificate && (
            <Button variant="outline" onClick={() => downloadCertificate(certificate.employee_name || user?.full_name || 'Certificate holder', cls.title, certificate)}>
              <Award className="mr-1.5 h-4 w-4" /> Download certificate
            </Button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{rating ? 'Your rating' : 'How was this class?'}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => rate(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} className="p-0.5">
                  <Star className={`h-5 w-5 ${rating && value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentTypeBadge({ type }) {
  const map = {
    pdf: { label: 'PDF', icon: FileText, tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
    on_demand_video: { label: 'Video', icon: Video, tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
    live_class: { label: 'Live Class', icon: Radio, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
    linked_document: { label: 'Linked Document', icon: FileText, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  };
  const m = map[type] || map.pdf;
  const Icon = m.icon;
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${m.tone}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}