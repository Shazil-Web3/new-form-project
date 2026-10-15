import React, { useMemo } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchingQuestion({ pairs, value, onChange }) {
  // Stable shuffled order of right-side options (by pair index), computed once per question.
  const rightOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), [pairs]);

  const usedElsewhere = (ri, li) =>
    Object.entries(value || {}).some(([k, v]) => Number(k) !== li && v === ri);

  const availableFor = (li) => rightOrder.filter((ri) => ri === value?.[li] || !usedElsewhere(ri, li));

  return (
    <div className="space-y-2">
      {pairs.map((pair, li) => (
        <div key={li} className="flex items-center gap-3">
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {pair?.left}
          </div>
          <span className="text-slate-300">→</span>
          <Select
            value={value?.[li] != null ? String(value[li]) : ''}
            onValueChange={(v) => onChange({ ...value, [li]: Number(v) })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select match…" />
            </SelectTrigger>
            <SelectContent>
              {availableFor(li).map((ri) => (
                <SelectItem key={ri} value={String(ri)}>{pairs[ri]?.right}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}