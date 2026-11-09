import React from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Trash2, Check } from 'lucide-react';

const typeLabel = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  fill_blank: 'Fill in the Blank (typed)',
  fill_blank_choice: 'Fill in the Blank',
  matching: 'Matching',
};

export default function QuestionEditor({ q, index, onChange, onSave, onDelete }) {
  const type = q.question_type || 'multiple_choice';

  const setOption = (oi, val) => {
    const options = [...(q.options || [])];
    options[oi] = val;
    onChange({ options });
  };
  const addOption = () => {
    const options = [...(q.options || []), 'New option'];
    onChange({ options });
    onSave({ ...q, options });
  };
  const removeOption = (oi) => {
    const options = (q.options || []).filter((_, i) => i !== oi);
    const correct_index = q.correct_index >= options.length ? 0 : q.correct_index;
    onChange({ options, correct_index });
    onSave({ ...q, options, correct_index });
  };

  const setAnswer = (ai, val) => {
    const acceptable_answers = [...(q.acceptable_answers || [])];
    acceptable_answers[ai] = val;
    onChange({ acceptable_answers });
  };
  const addAnswer = () => {
    const acceptable_answers = [...(q.acceptable_answers || []), ''];
    onChange({ acceptable_answers });
    onSave({ ...q, acceptable_answers });
  };
  const removeAnswer = (ai) => {
    const acceptable_answers = (q.acceptable_answers || []).filter((_, i) => i !== ai);
    onChange({ acceptable_answers });
    onSave({ ...q, acceptable_answers });
  };

  const setPair = (pi, field, val) => {
    const match_pairs = [...(q.match_pairs || [])];
    match_pairs[pi] = { ...(match_pairs[pi] || {}), [field]: val };
    onChange({ match_pairs });
  };
  const addPair = () => {
    const match_pairs = [...(q.match_pairs || []), { left: '', right: '' }];
    onChange({ match_pairs });
    onSave({ ...q, match_pairs });
  };
  const removePair = (pi) => {
    const match_pairs = (q.match_pairs || []).filter((_, i) => i !== pi);
    onChange({ match_pairs });
    onSave({ ...q, match_pairs });
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Question {index + 1}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{typeLabel[type]}</span>
        </div>
        <button onClick={onDelete} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Textarea
        value={q.question}
        onChange={(e) => onChange({ question: e.target.value })}
        onBlur={() => onSave(q)}
        rows={2}
        className="mb-3"
        placeholder={(type === 'fill_blank' || type === 'fill_blank_choice') ? 'Use ___ to mark the blank, e.g. "The capital of France is ___."' : 'Enter the question…'}
      />

      {(type === 'multiple_choice' || type === 'fill_blank_choice') && (
        <div className="space-y-2">
          {(q.options || []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <button
                onClick={() => { onChange({ correct_index: oi }); onSave({ ...q, correct_index: oi }); }}
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs ${q.correct_index === oi ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}
              >
                ✓
              </button>
              <Input
                value={opt}
                onChange={(e) => setOption(oi, e.target.value)}
                onBlur={() => onSave(q)}
                placeholder={`Option ${String.fromCharCode(65 + oi)}`}
              />
              {(q.options || []).length > 2 && (
                <button onClick={() => removeOption(oi)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addOption} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
          <p className="text-xs text-slate-400">Click the circle to mark the correct answer.</p>
        </div>
      )}

      {type === 'true_false' && (
        <div className="flex gap-2">
          {['True', 'False'].map((val, oi) => (
            <button
              key={val}
              onClick={() => { onChange({ correct_index: oi }); onSave({ ...q, correct_index: oi }); }}
              className={`flex-1 rounded-xl border-2 p-3 text-sm font-medium transition ${q.correct_index === oi ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${q.correct_index === oi ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                  {q.correct_index === oi && <Check className="h-3 w-3" />}
                </div>
                {val}
              </div>
            </button>
          ))}
          <p className="text-xs text-slate-400">Select the correct answer.</p>
        </div>
      )}

      {type === 'fill_blank' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Accepted answers — any one counts as correct (case-insensitive):</p>
          {(q.acceptable_answers || []).map((ans, ai) => (
            <div key={ai} className="flex items-center gap-2">
              <Input
                value={ans}
                onChange={(e) => setAnswer(ai, e.target.value)}
                onBlur={() => onSave(q)}
                placeholder={`Accepted answer ${ai + 1}`}
              />
              {(q.acceptable_answers || []).length > 1 && (
                <button onClick={() => removeAnswer(ai)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addAnswer} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add accepted answer
          </button>
        </div>
      )}

      {type === 'matching' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Learners match each left item to the correct right item. The right column is shuffled for them.</p>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-400">
            <span>Left list</span>
            <span>Right list (correct match)</span>
          </div>
          {(q.match_pairs || []).map((pair, pi) => (
            <div key={pi} className="flex items-center gap-2">
              <Input value={pair?.left || ''} onChange={(e) => setPair(pi, 'left', e.target.value)} onBlur={() => onSave(q)} placeholder={`Item ${pi + 1}`} />
              <span className="text-slate-300">↔</span>
              <Input value={pair?.right || ''} onChange={(e) => setPair(pi, 'right', e.target.value)} onBlur={() => onSave(q)} placeholder={`Match ${pi + 1}`} />
              {(q.match_pairs || []).length > 2 && (
                <button onClick={() => removePair(pi)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addPair} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add pair
          </button>
        </div>
      )}

    </Card>
  );
}