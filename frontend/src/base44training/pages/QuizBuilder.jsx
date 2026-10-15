import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser, cleanQuestion } from '../lib/training';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { ArrowLeft, Plus, ListChecks, RefreshCw, Info } from 'lucide-react';
import QuestionEditor from '../components/quiz/QuestionEditor';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank_choice', label: 'Fill in the Blank' },
  { value: 'matching', label: 'Matching' },
];

const typeDefaults = {
  multiple_choice: { options: ['Option A', 'Option B', 'Option C', 'Option D'], correct_index: 0 },
  true_false: { options: ['True', 'False'], correct_index: 0 },
  fill_blank: { acceptable_answers: [''] },
  fill_blank_choice: { options: ['Option A', 'Option B', 'Option C'], correct_index: 0 },
  matching: { match_pairs: [{ left: '', right: '' }, { left: '', right: '' }] },
};

// Payload for a live QuizQuestion record (adds quiz_id for bulk create).
function liveQuestionPayload(quizId, q) {
  return { quiz_id: quizId, ...cleanQuestion(q) };
}

export default function QuizBuilder() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const origin = location.state?.from; // 'library' | 'catalog' | undefined
  const originCurriculumId = location.state?.curriculumId;

  const backTo = origin === 'library'
    ? '/training/library'
    : origin === 'catalog' && originCurriculumId
      ? `/training/catalog?curriculum=${originCurriculumId}`
      : '/training/catalog';
  const backLabel = origin === 'library'
    ? 'Back to Class Library'
    : origin === 'catalog'
      ? 'Back to Content Catalog'
      : 'Back to catalog';

  const [user, setUser] = useState(null);
  const [cls, setCls] = useState(null);        // the class from the URL
  const [editCls, setEditCls] = useState(null); // the class whose quiz is being edited
  const [quiz, setQuiz] = useState(null);      // working quiz: { id?, passing_score, title? }
  const [questions, setQuestions] = useState([]); // working questions
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState('multiple_choice');

  // The quiz bank lives on the master class (not connected to any curriculum).
  // Any copy edits the master's quiz; copies mirror it on approval. A
  // standalone class (no master) edits its own quiz.
  const editingMaster = !!editCls && editCls.id !== classId;
  const editTargetIsLibrary = !!editCls && !editCls.curriculum_id;
  const pendingLibraryUpdate = editCls?.pending_library_update === true;

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const c = await base44.entities.Class.get(classId);
      setCls(c);
      const editId = c.library_class_id ? c.library_class_id : classId;
      const target = editId === classId ? c : await base44.entities.Class.get(editId);
      setEditCls(target);
      const quizzes = await base44.entities.Quiz.filter({ class_id: editId });
      const quizList = quizzes.items || quizzes;
      if (quizList.length > 0) {
        const q = quizList[0];
        setQuiz(q);
        const qs = await base44.entities.QuizQuestion.filter({ quiz_id: q.id });
        setQuestions(qs.items || qs);
      }
      setLoading(false);
    })();
  }, [classId]);

  // Flag the edit target (the master) as having a pending library update so it
  // is included in the next Class Library batch submission. Draft-curriculum
  // copies are not library classes, so their edits stay live without approval.
  async function markLibraryPending() {
    if (!editTargetIsLibrary) return;
    await base44.entities.Class.update(editCls.id, { pending_library_update: true });
    setEditCls((p) => ({ ...p, pending_library_update: true }));
  }

  // Ensure a live Quiz record exists on the edit target.
  async function ensureLiveQuiz() {
    if (quiz?.id) return quiz;
    const q = await base44.entities.Quiz.create({ title: `${editCls.title} Quiz`, class_id: editCls.id, passing_score: quiz?.passing_score ?? 70 });
    setQuiz(q);
    if (!editCls.has_quiz) {
      await base44.entities.Class.update(editCls.id, { has_quiz: true });
      setEditCls((p) => ({ ...p, has_quiz: true }));
    }
    return q;
  }

  async function addQuestion() {
    const def = typeDefaults[newType];
    const newQ = {
      id: `draft-${Date.now()}`,
      question_type: newType,
      question: newType === 'true_false' ? 'True or False?' : newType === 'fill_blank_choice' ? 'The capital of France is ___.' : 'New question?',
      ...def,
    };
    const next = [...questions, newQ];
    setQuestions(next);
    const q = await ensureLiveQuiz();
    const created = await base44.entities.QuizQuestion.create(liveQuestionPayload(q.id, newQ));
    // swap the temporary draft id for the saved record's id so later edits/deletes hit the real row
    if (created?.id) setQuestions((prev) => prev.map((qq) => (qq.id === newQ.id ? { ...qq, id: created.id } : qq)));
    await markLibraryPending();
  }

  function updateQuestion(id, patch) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function saveQuestion(q) {
    const next = questions.map((qq) => (qq.id === q.id ? { ...qq, ...q } : qq));
    setQuestions(next);
    if (q.id) {
      await base44.entities.QuizQuestion.update(q.id, cleanQuestion(q));
      await markLibraryPending();
    }
  }

  async function deleteQuestion(id) {
    const next = questions.filter((q) => q.id !== id);
    setQuestions(next);
    if (id) {
      await base44.entities.QuizQuestion.delete(id);
      await markLibraryPending();
    }
  }

  async function savePassingScore(score) {
    const nextQuiz = { ...(quiz || { passing_score: 70 }), passing_score: Number(score) };
    setQuiz(nextQuiz);
    const q = await ensureLiveQuiz();
    await base44.entities.Quiz.update(q.id, { passing_score: Number(score) });
    await markLibraryPending();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  // A copy placed in a curriculum does not own a quiz: the library (parent) class does, so send admins there.
  if (editingMaster) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button onClick={() => navigate(backTo)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-violet-600" />
            <h1 className="text-lg font-semibold text-slate-900">Quiz is managed on the library class</h1>
          </div>
          <p className="text-sm text-slate-500">
            "{cls?.title}" in this curriculum is a copy. Its quiz comes from the library class, so there is only one quiz to maintain.
          </p>
          <Button onClick={() => navigate(`/training/quiz/${editCls.id}`, { state: { from: 'library' } })}>
            <ListChecks className="mr-1.5 h-4 w-4" /> Open the library class quiz
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => navigate(backTo)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>

      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-violet-600" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quiz Builder</h1>
          <p className="text-sm text-slate-500">{cls?.title}</p>
        </div>
        {pendingLibraryUpdate && (
          <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Pending — submit from the Class Library for manager approval">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {editingMaster && (
        <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>You're editing the shared quiz for this class. Once approved in the Class Library, the update rolls out to every curriculum using it.</span>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-violet-600" />
            <Label className="text-sm font-medium text-slate-700">Passing score (%)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" min="0" max="100" defaultValue={quiz?.passing_score ?? 70} onBlur={(e) => savePassingScore(e.target.value)} className="w-20" />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <QuestionEditor
            key={q.id || `d${qi}`}
            q={q}
            index={qi}
            onChange={(patch) => updateQuestion(q.id, patch)}
            onSave={(qq) => saveQuestion(qq)}
            onDelete={() => deleteQuestion(q.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={addQuestion} variant="outline" className="flex-1 border-dashed">
          <Plus className="mr-1.5 h-4 w-4" /> Add {QUESTION_TYPES.find((t) => t.value === newType)?.label} Question
        </Button>
      </div>
    </div>
  );
}