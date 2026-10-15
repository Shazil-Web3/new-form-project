import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { message } from 'antd';
import { BackLink, PageHeader } from '../../components/common';
import { ConfirmModal } from '../../components/Modal';
import { questionsOf, quizOf } from '../../selectors';
import { trainingService, useTrainingState } from '../../store';
import { QUESTION_TYPES, ui } from '../../theme';

const MAX_OPTIONS = 6;

function QuestionCard({ question, index, onDelete }) {
  const [draft, setDraft] = useState(question);
  const skipNextAutosave = useRef(true);

  useEffect(() => {
    skipNextAutosave.current = true;
    setDraft(question);
  }, [question]);

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const setOption = (optionIndex, value) => set({ options: draft.options.map((option, i) => (i === optionIndex ? value : option)) });
  const removeOption = (optionIndex) => {
    const options = draft.options.filter((_, i) => i !== optionIndex);
    let correct = draft.correct_index;
    if (optionIndex < correct) correct -= 1;
    if (optionIndex === correct) correct = 0;
    set({ options, correct_index: correct });
  };
  const setPair = (pairIndex, side, value) =>
    set({ match_pairs: draft.match_pairs.map((pair, i) => (i === pairIndex ? { ...pair, [side]: value } : pair)) });

  // Autosaves shortly after every edit — there is no "Save question" button, so an
  // incomplete draft (empty text/options) is left unsaved rather than warned about.
  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return undefined;
    }
    const timeout = setTimeout(() => {
      const text = draft.question.trim();
      if (!text) return;
      if ((draft.question_type === 'multiple_choice' || draft.question_type === 'fill_blank') && draft.options.some((option) => !option.trim())) return;
      if (draft.question_type === 'matching') {
        if (draft.match_pairs.length < 2 || draft.match_pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) return;
      }
      trainingService.updateQuestion(question.id, {
        question: text,
        options: draft.options.map((option) => option.trim()),
        correct_index: draft.correct_index,
        match_pairs: draft.match_pairs.map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() })),
        time_limit_seconds: draft.time_limit_seconds === '' || draft.time_limit_seconds === null ? null : Number(draft.time_limit_seconds),
      });
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className={`${ui.card} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Question {index + 1}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{QUESTION_TYPES[question.question_type]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-slate-400" title="Time limit (seconds)">timer</span>
          <input
            type="number"
            min="0"
            placeholder="None"
            value={draft.time_limit_seconds ?? ''}
            onChange={(event) => set({ time_limit_seconds: event.target.value })}
            aria-label={`Time limit in seconds for question ${index + 1}`}
            title="Time limit (seconds)"
            className={`${ui.input} w-16 px-2 py-1 text-center text-xs`}
          />
          <button type="button" onClick={onDelete} className={`${ui.iconBtn} hover:text-red-600`} aria-label={`Delete question ${index + 1}`}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>

      <textarea
        className={`${ui.input} mt-3`}
        rows={2}
        value={draft.question}
        onChange={(event) => set({ question: event.target.value })}
        aria-label={`Question ${index + 1} text`}
      />

      {draft.question_type === 'multiple_choice' || draft.question_type === 'fill_blank' ? (
        <div className="mt-3 space-y-2">
          {draft.question_type === 'fill_blank' ? (
            <div className="text-xs text-slate-400">Use ____ in the question for the blank.</div>
          ) : null}
          {draft.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set({ correct_index: optionIndex })}
                aria-label={`Mark option ${optionIndex + 1} as correct`}
                aria-pressed={draft.correct_index === optionIndex}
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                  draft.correct_index === optionIndex ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-slate-400'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
              <input className={ui.input} value={option} onChange={(event) => setOption(optionIndex, event.target.value)} aria-label={`Option ${optionIndex + 1}`} />
              <button
                type="button"
                onClick={() => removeOption(optionIndex)}
                disabled={draft.options.length <= 2}
                className={`${ui.iconBtn} disabled:opacity-30`}
                aria-label={`Remove option ${optionIndex + 1}`}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
          {draft.options.length < MAX_OPTIONS ? (
            <button type="button" onClick={() => set({ options: [...draft.options, `Option ${String.fromCharCode(65 + draft.options.length)}`] })} className={ui.link}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add option
            </button>
          ) : null}
          <p className="text-xs text-slate-400">Click the circle to mark the correct answer.</p>
        </div>
      ) : null}

      {draft.question_type === 'true_false' ? (
        <div className="mt-3">
          <div className="mb-2 text-xs text-slate-400">Choose the correct answer.</div>
          <div className="flex gap-2">
            {['True', 'False'].map((label, optionIndex) => (
              <button
                key={label}
                type="button"
                onClick={() => set({ correct_index: optionIndex })}
                aria-pressed={draft.correct_index === optionIndex}
                className={`rounded-lg border px-5 py-2 text-sm font-semibold ${
                  draft.correct_index === optionIndex ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draft.question_type === 'matching' ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-slate-400">Each row is a correct pair. Learners see the right-hand items shuffled.</div>
          {draft.match_pairs.map((pair, pairIndex) => (
            <div key={pairIndex} className="flex items-center gap-3">
              <input className={ui.input} value={pair.left} onChange={(event) => setPair(pairIndex, 'left', event.target.value)} aria-label={`Left item ${pairIndex + 1}`} />
              <span className="material-symbols-outlined text-slate-300">link</span>
              <input className={ui.input} value={pair.right} onChange={(event) => setPair(pairIndex, 'right', event.target.value)} aria-label={`Right item ${pairIndex + 1}`} />
              <button
                type="button"
                disabled={draft.match_pairs.length <= 2}
                onClick={() => set({ match_pairs: draft.match_pairs.filter((_, i) => i !== pairIndex) })}
                className={`${ui.iconBtn} disabled:opacity-30`}
                aria-label={`Remove pair ${pairIndex + 1}`}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set({ match_pairs: [...draft.match_pairs, { left: '', right: '' }] })} className={ui.link}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add pair
          </button>
        </div>
      ) : null}

    </div>
  );
}

export default function QuizBuilder() {
  const { classId } = useParams();
  const state = useTrainingState();
  const [type, setType] = useState('multiple_choice');
  const [toDelete, setToDelete] = useState(null);

  const entry = state.classes.find((item) => item.id === classId);
  const quiz = entry ? quizOf(state, classId) : null;
  const [score, setScore] = useState(quiz?.passing_score ?? 80);
  const [perAttempt, setPerAttempt] = useState(quiz?.questions_per_attempt ?? '');
  const [maxAttempts, setMaxAttempts] = useState(quiz?.max_attempts ?? '');

  useEffect(() => {
    if (quiz) {
      setScore(quiz.passing_score);
      setPerAttempt(quiz.questions_per_attempt ?? '');
      setMaxAttempts(quiz.max_attempts ?? '');
    }
  }, [quiz]);

  if (!entry) return <Navigate to="/training/catalog" replace />;

  const curriculum = state.curriculums.find((item) => item.id === entry.curriculum_id);
  const backTo = curriculum ? `/training/catalog/${curriculum.field_specialty_id}/${curriculum.id}` : '/training/catalog';
  const questions = quiz ? questionsOf(state, quiz.id) : [];
  const examSize = Number(quiz?.questions_per_attempt) > 0 ? Math.min(quiz.questions_per_attempt, questions.length) : questions.length;
  const neededToPass = Math.ceil((examSize * (Math.min(100, Math.max(0, Number(score) || 0)))) / 100);

  const addQuestion = () => {
    if (!entry.has_quiz) trainingService.updateClass(entry.id, { ...entry, has_quiz: true });
    trainingService.addQuestion(classId, type);
  };

  const commitScore = () => {
    const value = Math.min(100, Math.max(0, Number(score) || 0));
    setScore(value);
    trainingService.setPassingScore(classId, value);
  };

  const commitMaxAttempts = () => {
    const value = Math.max(0, Math.floor(Number(maxAttempts) || 0));
    setMaxAttempts(value || '');
    trainingService.setMaxAttempts(classId, value);
  };

  const commitPerAttempt = () => {
    const value = Math.max(0, Math.min(questions.length, Number(perAttempt) || 0));
    setPerAttempt(value || '');
    trainingService.setQuestionsPerAttempt(classId, value);
  };

  return (
    <div className={ui.narrow}>
      <BackLink to={backTo} label="Back to catalog" />
      <PageHeader title="Quiz Builder" subtitle={entry.title} />

      <div className={`${ui.card} mt-6 flex items-center justify-between gap-4 p-5`}>
        <label htmlFor="passing-score" className="flex items-center gap-3 text-sm font-semibold text-slate-800">
          <span className="material-symbols-outlined text-violet-600">checklist</span>
          Passing score (%)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="passing-score"
            type="number"
            min="0"
            max="100"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            onBlur={commitScore}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            className={`${ui.input} w-24 text-center`}
          />
          <span className="text-sm text-slate-400">%</span>
        </div>
      </div>
      {questions.length > 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          Each question is worth 1 point. Students need {neededToPass} of {examSize} correct to pass.
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <div className={`${ui.card} flex flex-1 flex-col gap-2 p-4`}>
          <label htmlFor="max-attempts" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="material-symbols-outlined text-[20px] text-violet-600">replay</span>
            Maximum attempts
          </label>
          <input
            id="max-attempts"
            type="number"
            min="0"
            placeholder="Unlimited"
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(event.target.value)}
            onBlur={commitMaxAttempts}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            className={`${ui.input} w-full`}
          />
        </div>

        {questions.length > 0 ? (
          <div className={`${ui.card} flex flex-1 flex-col gap-2 p-4`}>
            <label htmlFor="questions-per-attempt" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="material-symbols-outlined text-[20px] text-violet-600">shuffle</span>
              Questions per attempt
            </label>
            <div className="flex items-center gap-2">
              <input
                id="questions-per-attempt"
                type="number"
                min="0"
                max={questions.length}
                placeholder={String(questions.length)}
                value={perAttempt}
                onChange={(event) => setPerAttempt(event.target.value)}
                onBlur={commitPerAttempt}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                className={`${ui.input} w-full`}
              />
              <span className="flex-none text-sm text-slate-400">of {questions.length}</span>
            </div>
          </div>
        ) : null}
      </div>
      {questions.length > 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          Leave blank (or 0) to use every question. Set a number lower than the bank size and each attempt draws a fresh random subset.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {questions.map((question, index) => (
          <QuestionCard key={question.id} question={question} index={index} onDelete={() => setToDelete(question)} />
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <select value={type} onChange={(event) => setType(event.target.value)} className={`${ui.input} sm:w-56`} aria-label="Question type">
          {Object.entries(QUESTION_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addQuestion}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-violet-400 hover:text-violet-700"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add {QUESTION_TYPES[type]} Question
        </button>
      </div>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete question?"
        message="This question will be removed from the quiz."
        onConfirm={() => {
          trainingService.deleteQuestion(toDelete.id);
          setToDelete(null);
          message.success('Question deleted');
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
