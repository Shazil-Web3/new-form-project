import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, ListChecks, XCircle, Award } from 'lucide-react';
import MatchingQuestion from '../components/quiz/MatchingQuestion';

function isAnswered(q, answers) {
  const a = answers[q.id];
  const type = q.question_type || 'multiple_choice';
  if (type === 'multiple_choice' || type === 'true_false' || type === 'fill_blank_choice') return a != null;
  if (type === 'fill_blank') return a && a.trim() !== '';
  if (type === 'matching') return a && (q.match_pairs || []).every((_, i) => a[i] != null);
  return false;
}

export default function TakeQuiz() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cls, setCls] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const c = await base44.entities.Class.get(classId);
      setCls(c);
      const quizzes = await base44.entities.Quiz.filter({ class_id: classId });
      if (quizzes.length > 0) {
        const q = quizzes[0];
        setQuiz(q);
        const qs = await base44.entities.QuizQuestion.filter({ quiz_id: q.id });
        setQuestions(qs);
      }
      setLoading(false);
    })();
  }, [classId]);

  function setAnswer(qId, value) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      // Graded on the server: the answer key is never sent to the browser.
      const graded = await base44.quiz.submit(classId, answers);
      setResult({ score: graded.score, passed: graded.passed, correct: graded.correct, total: graded.total });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <ListChecks className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">No quiz has been set up for this class yet.</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className={`rounded-2xl border p-8 text-center ${result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${result.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            {result.passed ? <Award className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">{result.passed ? 'Passed!' : 'Not passed'}</h2>
          <p className="mt-1 text-sm text-slate-600">
            You scored {result.score}% ({result.correct} of {result.total} correct). Passing score: {quiz.passing_score}%.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { setResult(null); setAnswers({}); }} variant="outline" className="flex-1">Try Again</Button>
          <Link to="/training/my-training" className="flex-1"><Button className="w-full">Back to My Training</Button></Link>
        </div>
      </div>
    );
  }

  const answeredCount = questions.filter((q) => isAnswered(q, answers)).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
            <ListChecks className="h-3 w-3" /> Quiz
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{quiz.title}</h1>
        <p className="mt-1 text-sm text-slate-500">Answer all {questions.length} questions. Passing score: {quiz.passing_score}%.</p>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => {
          const type = q.question_type || 'multiple_choice';
          return (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-medium text-slate-900">
                <span className="mr-1.5 text-slate-400">{qi + 1}.</span>{q.question}
              </p>

              {(type === 'multiple_choice' || type === 'true_false' || type === 'fill_blank_choice') && (
                <div className="space-y-2">
                  {(q.options || []).map((opt, oi) => {
                    const selected = answers[q.id] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswer(q.id, oi)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${
                          selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                          {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {type === 'fill_blank' && (
                <Input
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Type your answer…"
                  className="max-w-md"
                />
              )}

              {type === 'matching' && (
                <MatchingQuestion
                  pairs={q.match_pairs || []}
                  value={answers[q.id] || {}}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={submit} disabled={answeredCount < questions.length || submitting} className="w-full" size="lg">
        {submitting ? 'Submitting…' : `Submit Quiz (${answeredCount}/${questions.length} answered)`}
      </Button>
    </div>
  );
}