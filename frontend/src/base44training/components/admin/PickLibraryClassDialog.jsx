import React, { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { FileText, Video, Radio, HelpCircle, Search, Check } from 'lucide-react';

const TYPE_META = {
  pdf: { label: 'PDF', icon: FileText, tone: 'text-rose-600 bg-rose-50' },
  on_demand_video: { label: 'Video', icon: Video, tone: 'text-indigo-600 bg-indigo-50' },
  live_class: { label: 'Live', icon: Radio, tone: 'text-emerald-600 bg-emerald-50' },
  linked_document: { label: 'Doc Link', icon: FileText, tone: 'text-amber-600 bg-amber-50' },
};

export default function PickLibraryClassDialog({ open, onClose, classes, quizClassIds, curriculum, existingClassIds, onPick }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  // Library masters already placed in this curriculum (by library_class_id).
  const alreadyPlacedIds = useMemo(() => {
    const ids = new Set();
    if (!existingClassIds) return ids;
    existingClassIds.forEach((id) => ids.add(id));
    return ids;
  }, [existingClassIds]);

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      if (typeFilter !== 'all' && c.content_type !== typeFilter) return false;
      if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [classes, typeFilter, search]);

  function close() {
    setSearch('');
    setTypeFilter('all');
    setSelectedId(null);
    onClose();
  }

  function confirm() {
    const cls = classes.find((c) => c.id === selectedId);
    if (!cls) return;
    onPick(cls);
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Class from Library to "{curriculum?.name || ''}"</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes…" className="pl-8" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All content types</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="on_demand_video">On-demand video</SelectItem>
              <SelectItem value="live_class">Live class</SelectItem>
              <SelectItem value="linked_document">Linked document</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No classes match.</div>
          ) : filtered.map((c) => {
            const meta = TYPE_META[c.content_type] || TYPE_META.pdf;
            const Icon = meta.icon;
            const hasQuiz = quizClassIds.has(c.id);
            const selected = selectedId === c.id;
            const alreadyAdded = alreadyPlacedIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => !alreadyAdded && setSelectedId(c.id)}
                disabled={alreadyAdded}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 ${alreadyAdded ? 'cursor-not-allowed opacity-50' : selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    {meta.label}
                    {c.duration_minutes > 0 ? ` · ${c.duration_minutes} min` : ''}
                  </p>
                </div>
                {alreadyAdded ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <Check className="h-3 w-3" /> Added
                  </span>
                ) : (
                  <>
                    {hasQuiz && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        <HelpCircle className="h-3 w-3" /> Quiz
                      </span>
                    )}
                    {selected && <Check className="h-4 w-4 text-indigo-600" />}
                  </>
                )}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" onClick={close}>Cancel</Button></DialogClose>
          <Button onClick={confirm} disabled={!selectedId}>Add to Curriculum</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}