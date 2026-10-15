import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { message } from 'antd';
import { BackLink, EmptyState } from '../../components/common';
import { useTrainingContext } from '../../context';
import { attemptsOf, questionsOf, quizOf } from '../../selectors';
import { trainingService, useTrainingState } from '../../store';
import { QUESTION_TYPES, ui } from '../../theme';

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const isAnswered = (question, answer) => {
  if (question.question_type === 'matching') {
    return Array.isArray(answer) && answer.length === question.match_pairs.length && answer.every(Boolean);
  }
  return answer !== undefined && answer !== null;
};

// The quiz-taking fetch never sends the answer key (correct_index / the right side of
// match_pairs), so the review screen must read those from the submit response's
// `results` entry instead of from the stripped `question`.
const correctText = (resultEntry, question) => {
  if (!resultEntry) return '';
  if (question.question_type === 'matching') {
    return (resultEntry.match_pairs || []).map((pair) => `${pair.left} → ${pair.right}`).join(', ');
  }
  return question.options[resultEntry.correct_index];
};

const givenText = (question, answer) => {
  if (answer === undefined || answer === null || answer === '') return 'No answer';
  if (question.question_type === 'matching') return question.match_pairs.map((pair, index) => `${pair.left} → ${answer[index] || '—'}`).join(', ');
  return question.options[Number(answer)] ?? 'No answer';
};

function QuestionInput({ question, index, answer, options, optionOrder, disabled, onChange }) {
  if (question.question_type === 'matching') {
    const current = Array.isArray(answer) ? answer : question.match_pairs.map(() => '');
    return (
      <div className="mt-4 space-y-2">
        {question.match_pairs.map((pair, pairIndex) => (
          <div key={pairIndex} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800">{pair.left}</div>
            <span className="material-symbols-outlined hidden text-slate-300 sm:block">arrow_forward</span>
            <select
              className={`${ui.input} flex-1`}
              value={current[pairIndex] || ''}
              disabled={disabled}
              onChange={(event) => onChange(current.map((entry, i) => (i === pairIndex ? event.target.value : entry)))}
              aria-label={`Match for ${pair.left}`}
            >
              <option value="">Choose a match…</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  const order = optionOrder || question.options.map((_, i) => i);

  return (
    <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Question ${index + 1} options`}>
      {order.map((optionIndex) => {
        const option = question.options[optionIndex];
        const checked = answer === optionIndex;
        return (
          <label
            key={optionIndex}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${checked ? 'border-violet-500 bg-violet-50 text-slate-900' : `border-slate-200 text-slate-700 ${disabled ? '' : 'hover:bg-slate-50'}`}`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(optionIndex)}
              className="h-4 w-4 border-slate-300 text-violet-700 focus:ring-violet-600"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

function ResultView({ result, questions, answers, attempts, canRetake, onRetake }) {
  const score = result.attempt.score;
  const passed = result.attempt.passed;
  return (
    <div>
      <div className={`${ui.card} p-8 text-center`}>
        <span className={`material-symbols-outlined text-[56px] ${passed ? 'text-emerald-500' : 'text-red-500'}`}>{passed ? 'check_circle' : 'cancel'}</span>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{passed ? 'You passed!' : 'Not quite there yet'}</h2>
        <div className="mt-3 text-5xl font-bold text-slate-900">{score}%</div>
        <p className="mt-2 text-sm text-slate-500">
          You answered {result.correct} of {result.total} correctly. Passing score: {result.passingScore}% ({result.required} of {result.total} needed).
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Attempt {attempts} · Attempts are recorded and visible to your manager.
        </p>
        {!passed && !canRetake ? <p className="mt-2 text-xs font-medium text-red-500">You have used all available attempts.</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!passed && canRetake ? (
            <button type="button" onClick={onRetake} className={ui.btnDark}>
              <span className="material-symbols-outlined text-[20px]">replay</span>
              Retake quiz
            </button>
          ) : null}
          <Link to="/training/my-training" className={passed ? ui.btnDark : ui.btnLight}>
            Back to training
          </Link>
        </div>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">Review</h3>
      <div className="space-y-3">
        {questions.map((question, index) => {
          const resultEntry = result.results.find((entry) => entry.id === question.id);
          const correct = resultEntry?.correct;
          return (
            <div key={question.id} className={`${ui.card} p-4`}>
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined text-[22px] ${correct ? 'text-emerald-500' : 'text-red-500'}`}>{correct ? 'check_circle' : 'cancel'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">
                    {index + 1}. {question.question}
                  </div>
                  {!correct ? (
                    <div className="mt-1 space-y-0.5 text-xs">
                      <div className="text-red-600">Your answer: {givenText(question, answers[question.id])}</div>
                      <div className="text-emerald-700">Correct answer: {correctText(resultEntry, question)}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QuizTake() {
  const { classId } = useParams();
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);
  // Frozen at submit time: submitting re-hydrates the store, which (for a question-bank
  // quiz) redraws a fresh random subset for the *next* attempt — so the live `questions`
  // selector would show the review against a different set than what was just answered.
  const [submittedQuestions, setSubmittedQuestions] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // One question on screen at a time, so a per-question time limit is a real countdown for
  // THAT question rather than a shared clock every timed question races against together.
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStarts, setQuestionStarts] = useState({});
  const [now, setNow] = useState(() => Date.now());

  const entry = state.classes.find((item) => item.id === classId);
  const quiz = entry ? quizOf(state, classId) : null;
  const questions = useMemo(() => (quiz ? questionsOf(state, quiz.id) : []), [state, quiz]);

  const matchOptions = useMemo(
    () => Object.fromEntries(questions.filter((question) => question.question_type === 'matching').map((question) => [question.id, shuffle(question.match_options)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quiz?.id, questions.length, round]
  );

  // Re-shuffled every attempt (including a retake, since `round` is a dependency) so a
  // question's choices don't sit in the same order the student just got wrong.
  const optionOrders = useMemo(
    () =>
      Object.fromEntries(
        questions
          .filter((question) => question.question_type === 'multiple_choice' || question.question_type === 'fill_blank')
          .map((question) => [question.id, shuffle(question.options.map((_, i) => i))])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quiz?.id, questions.length, round]
  );

  // Question order itself is re-shuffled every attempt too, so a retake isn't just the
  // same 10 questions in the same sequence.
  const orderedQuestions = useMemo(
    () => shuffle(questions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quiz?.id, questions.length, round]
  );

  useEffect(() => {
    setCurrentIndex(0);
    setQuestionStarts({});
    setNow(Date.now());
  }, [quiz?.id, round]);

  const currentQuestion = orderedQuestions[currentIndex];

  // A question's timer starts the moment it's first shown, not when the attempt began.
  useEffect(() => {
    if (!currentQuestion || result) return;
    setQuestionStarts((current) => (current[currentQuestion.id] ? current : { ...current, [currentQuestion.id]: Date.now() }));
  }, [currentQuestion, result]);

  const hasTimedQuestion = questions.some((question) => question.time_limit_seconds);
  useEffect(() => {
    if (!hasTimedQuestion || result) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasTimedQuestion, result]);

  const secondsLeft = (question) => {
    if (!question.time_limit_seconds) return null;
    const startedQuestionAt = questionStarts[question.id];
    if (!startedQuestionAt) return question.time_limit_seconds;
    return Math.max(0, question.time_limit_seconds - Math.floor((now - startedQuestionAt) / 1000));
  };
  const isExpired = (question) => secondsLeft(question) === 0;
  const isLast = currentIndex === orderedQuestions.length - 1;
  const currentExpired = currentQuestion ? isExpired(currentQuestion) : false;
  const goNext = () => setCurrentIndex((index) => Math.min(index + 1, orderedQuestions.length - 1));

  // A question's timer running out moves the student on automatically after a beat, so the
  // quiz doesn't stall on a question they can no longer answer.
  useEffect(() => {
    if (!currentExpired || result || isLast) return undefined;
    const timeout = setTimeout(goNext, 900);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExpired, currentQuestion?.id, isLast, result]);

  if (!entry) return <Navigate to="/training/my-training" replace />;

  const enrolled = state.assignments.some((item) => item.employee_id === persona.id && item.curriculum_id === entry.curriculum_id);
  if (!enrolled) {
    return (
      <div className={ui.narrow}>
        <BackLink to="/training/my-training" />
        <EmptyState icon="lock" message="You are not enrolled in the curriculum this quiz belongs to." actionLabel="Browse electives" actionTo="/training/electives" />
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className={ui.narrow}>
        <BackLink to={`/training/class/${classId}`} />
        <EmptyState icon="checklist" message="No quiz has been set up for this class yet." />
      </div>
    );
  }

  const attemptsLeft = quiz.max_attempts ? quiz.max_attempts - quiz.attempts_used : null;
  if (!result && !submitting && attemptsLeft !== null && attemptsLeft <= 0) {
    return (
      <div className={ui.narrow}>
        <BackLink to={`/training/class/${classId}`} />
        <EmptyState icon="block" message={`You have used all ${quiz.max_attempts} attempt${quiz.max_attempts === 1 ? '' : 's'} for this quiz.`} />
      </div>
    );
  }

  const currentAnswered = currentQuestion ? isAnswered(currentQuestion, answers[currentQuestion.id]) : false;

  const submit = async () => {
    const payload = { ...answers };
    orderedQuestions.forEach((question) => {
      if (!isAnswered(question, payload[question.id]) && isExpired(question)) payload[question.id] = null;
    });
    setSubmitting(true);
    setSubmittedQuestions(orderedQuestions);
    try {
      const outcome = await trainingService.submitQuiz({ employeeId: persona.id, classId, answers: payload });
      if (outcome) {
        setAnswers(payload);
        setResult(outcome);
      }
    } catch (error) {
      setSubmittedQuestions(null);
      message.error(error?.response?.data?.error || 'Could not submit the quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const advance = () => {
    if (isLast) submit();
    else goNext();
  };

  const retake = () => {
    setAnswers({});
    setResult(null);
    setSubmittedQuestions(null);
    setCurrentIndex(0);
    setQuestionStarts({});
    setNow(Date.now());
    setRound((current) => current + 1);
  };

  return (
    <div className={ui.narrow}>
      <BackLink to={`/training/class/${classId}`} />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
        <span className="material-symbols-outlined text-[14px]">checklist</span>
        Quiz
      </span>
      <h1 className={`${ui.title} mt-3`}>{quiz.title || `${entry.title} Quiz`}</h1>
      <p className={ui.subtitle}>
        Passing score: {quiz.passing_score}% ({Math.ceil((questions.length * quiz.passing_score) / 100)} of {questions.length} correct).
        {attemptsLeft !== null ? ` ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` : ''}
      </p>

      <div className="mt-6">
        {result ? (
          <ResultView result={result} questions={submittedQuestions || questions} answers={answers} attempts={attemptsOf(state, persona.id, classId).length} canRetake={attemptsLeft === null || attemptsLeft > 0} onRetake={retake} />
        ) : currentQuestion ? (
          <>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>
                Question {currentIndex + 1} of {orderedQuestions.length}
              </span>
              {currentQuestion.time_limit_seconds ? (
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${currentExpired ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                  <span className="material-symbols-outlined text-[14px]">timer</span>
                  {currentExpired ? "Time's up" : `${Math.floor(secondsLeft(currentQuestion) / 60)}:${String(secondsLeft(currentQuestion) % 60).padStart(2, '0')}`}
                </span>
              ) : null}
            </div>
            <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / orderedQuestions.length) * 100}%` }}
              />
            </div>

            <div className={`${ui.card} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{currentQuestion.question}</div>
                <span className="hidden flex-none text-xs text-slate-400 sm:block">{QUESTION_TYPES[currentQuestion.question_type]}</span>
              </div>
              <QuestionInput
                question={currentQuestion}
                index={currentIndex}
                answer={answers[currentQuestion.id]}
                options={matchOptions[currentQuestion.id] || []}
                optionOrder={optionOrders[currentQuestion.id]}
                disabled={currentExpired}
                onChange={(value) => setAnswers((current) => ({ ...current, [currentQuestion.id]: value }))}
              />
            </div>

            <button
              type="button"
              disabled={!currentAnswered && !currentExpired}
              onClick={advance}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isLast ? 'Submit Quiz' : 'Next question'}
              <span className="material-symbols-outlined text-[18px]">{isLast ? 'send' : 'arrow_forward'}</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
