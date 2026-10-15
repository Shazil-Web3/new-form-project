import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser, formatDateTime } from '../lib/training';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, ChevronRight, FolderTree, BookOpen, FileText, Video, Radio, ListChecks,
  Clock, ExternalLink, HelpCircle, CheckCircle2, Pencil, RefreshCw,
} from 'lucide-react';
import ClassVideo from '../components/ClassVideo';
import LinkedDocumentView from '../components/LinkedDocumentView';

const contentTypeMeta = {
  pdf: { label: 'PDF', icon: FileText, tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  on_demand_video: { label: 'On-Demand Video', icon: Video, tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  live_class: { label: 'Live Class', icon: Radio, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  linked_document: { label: 'Linked Document', icon: FileText, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

const typeLabel = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  fill_blank: 'Fill in the blank (typed)',
  fill_blank_choice: 'Fill in the blank',
  matching: 'Matching',
};

export default function AdminClassDetail() {
  const { classId } = useParams();
  const [user, setUser] = useState(null);
  const [cls, setCls] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [specialty, setSpecialty] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const me = await getCurrentUser();
      if (active) setUser(me);
      const c = await base44.entities.Class.get(classId);
      if (!active) return;
      setCls(c);
      if (c?.curriculum_id) {
        const cur = await base44.entities.Curriculum.get(c.curriculum_id).catch(() => null);
        if (active) setCurriculum(cur);
        if (cur?.field_specialty_id) {
          const spec = await base44.entities.FieldSpecialty.get(cur.field_specialty_id).catch(() => null);
          if (active) setSpecialty(spec);
        }
      }
      if (c?.has_quiz) {
        const quizzes = await base44.entities.Quiz.filter({ class_id: classId });
        const q = (quizzes.items || quizzes)[0];
        if (active && q) {
          setQuiz(q);
          const page = await base44.entities.QuizQuestion.filter({ quiz_id: q.id }, { sort: 'created_date', limit: 200 });
          if (active) setQuestions(page.items || page || []);
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [classId]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  if (!cls) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Class not found.</div>;
  }

  const Meta = contentTypeMeta[cls.content_type] || contentTypeMeta.pdf;
  const Icon = Meta.icon;
  const isDeleted = cls.pending_operation === 'delete';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back + breadcrumb */}
      <div className="flex flex-col gap-2">
        <Link to={curriculum ? `/training/catalog?curriculum=${curriculum.id}` : '/training/catalog'} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to {curriculum ? curriculum.name : 'Content Catalog'}
        </Link>
        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {specialty && (
            <>
              <FolderTree className="h-3.5 w-3.5 text-indigo-500" />
              <span className="font-medium text-slate-700">{specialty.name}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          {curriculum && (
            <>
              <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-slate-700">{curriculum.name}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <Icon className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-medium text-slate-900">{cls.title}</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${Meta.tone}`}>
            <Icon className="h-3 w-3" /> {Meta.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls.type === 'elective' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
            {cls.type === 'elective' ? 'Elective' : 'Required'}
          </span>
          {cls.duration_minutes > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" /> {cls.duration_minutes} min</span>
          )}
          {isDeleted && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200" title="Pending delete — removed on publish approval">
              <RefreshCw className="mr-1 h-3 w-3" /> Pending delete
            </span>
          )}
        </div>
        <h1 className={`text-2xl font-semibold tracking-tight text-slate-900 ${isDeleted ? 'line-through text-slate-500' : ''}`}>{cls.title}</h1>
        {cls.description && <p className="mt-1 text-sm text-slate-500">{cls.description}</p>}
      </div>

      {/* Content viewer */}
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

      {/* Quiz section */}
      {cls.has_quiz && (
        <div className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/40 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-white/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-violet-600" />
              <span className="font-semibold text-slate-900">{quiz?.title || 'Quiz'}</span>
              <span className="text-xs text-slate-400">Passing score: {quiz?.passing_score ?? 70}%</span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                {questions.length} question{questions.length === 1 ? '' : 's'}
              </span>
              {cls.quiz_pending_update && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Quiz update pending — awaiting curriculum publish approval">
                  <RefreshCw className="h-3 w-3" />
                </span>
              )}
            </div>
            {cls.library_class_id ? (
              <span className="text-xs text-slate-500">View only. The quiz is managed on the library class.</span>
            ) : (
              <Link to={`/training/quiz/${cls.id}`} state={{ from: 'catalog', curriculumId: curriculum?.id }}>
                <Button size="sm" variant="outline">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit in Quiz Builder
                </Button>
              </Link>
            )}
          </div>
          <div className="space-y-3 p-5">
            {questions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-violet-200 bg-white p-6 text-center text-sm text-slate-400">
                This quiz has no questions yet.
              </div>
            ) : (
              questions.map((q, i) => (
                <div key={q.id || i} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      <span className="mr-1 text-slate-400">Q{i + 1}.</span>{q.question}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {typeLabel[q.question_type] || q.question_type}
                    </span>
                  </div>
                  {(q.question_type === 'multiple_choice' || q.question_type === 'fill_blank_choice') && Array.isArray(q.options) && (
                    <ul className="mt-2 space-y-1">
                      {q.options.map((opt, idx) => (
                        <li key={idx} className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${idx === q.correct_index ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}>
                          {idx === q.correct_index ? <CheckCircle2 className="h-4 w-4" /> : <span className="ml-4 inline-block h-4 w-4" />}
                          <span>{opt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.question_type === 'true_false' && (
                    <div className="mt-2 flex gap-2">
                      {['True', 'False'].map((opt, idx) => (
                        <span key={opt} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ${idx === q.correct_index ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
                          {idx === q.correct_index && <CheckCircle2 className="h-4 w-4" />}{opt}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.question_type === 'fill_blank' && Array.isArray(q.acceptable_answers) && q.acceptable_answers.length > 0 && (
                    <div className="mt-2 text-sm text-slate-600">
                      <span className="text-slate-400">Accepted answers:</span>{' '}
                      {q.acceptable_answers.map((a) => `"${a}"`).join(', ')}
                    </div>
                  )}
                  {q.question_type === 'matching' && Array.isArray(q.match_pairs) && q.match_pairs.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {q.match_pairs.map((p, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="rounded bg-slate-100 px-2 py-0.5">{p.left}</span>
                          <span className="text-slate-400">↔</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5">{p.right}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}