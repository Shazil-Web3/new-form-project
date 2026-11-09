import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { Search, BookOpen, Check } from 'lucide-react';

// Places an existing library master class into one or more curricula as linked copies.
// Curricula that already have a linked copy for this class are shown as already placed
// and excluded from the selection.
export default function PlaceClassInCurriculaDialog({ open, onClose, cls, curriculums, classes, onConfirm, busy }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  // Curricula that already contain a linked copy of this library master.
  const existingCurriculumIds = useMemo(() => {
    const ids = new Set();
    if (!cls) return ids;
    classes.forEach((c) => {
      if (c.library_class_id === cls.id && c.curriculum_id) ids.add(c.curriculum_id);
    });
    return ids;
  }, [cls, classes]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(new Set());
    }
  }, [open]);

  const available = useMemo(() => {
    return curriculums.filter((c) => {
      if (existingCurriculumIds.has(c.id)) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [curriculums, existingCurriculumIds, search]);

  const placedCurricula = useMemo(
    () => curriculums.filter((c) => existingCurriculumIds.has(c.id)),
    [curriculums, existingCurriculumIds]
  );

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const chosen = curriculums.filter((c) => selected.has(c.id));
    onConfirm(chosen);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Place "{cls?.title || ''}" in Curricula</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          A linked copy is added to each selected curriculum. Specialties are inferred from the curricula.
        </p>

        {placedCurricula.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Already placed ({placedCurricula.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {placedCurricula.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <Check className="h-3 w-3" /> {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search curricula…" className="pl-8" />
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-slate-200">
          {available.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {curriculums.length === 0 ? 'No curriculums exist yet.' : 'All curricula already contain this class.'}
            </div>
          ) : available.map((c) => {
            const checked = selected.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                  {checked && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <BookOpen className="h-4 w-4 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  <p className="truncate text-xs text-slate-400">{c.field_specialty_name || '—'}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.type === 'required' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}`}>
                  {c.type === 'required' ? 'Required' : 'Elective'}
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline" onClick={onClose}>Cancel</Button></DialogClose>
          <Button onClick={confirm} disabled={selected.size === 0 || busy}>
            {busy ? 'Placing…' : `Place in ${selected.size} curriculum${selected.size !== 1 ? 'a' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}