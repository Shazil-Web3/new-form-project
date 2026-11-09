import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '../ui/dialog';
import { FileText, Video, Radio, HelpCircle, Send, Library, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import ApproveMyselfButton from './ApproveMyselfButton';

const TYPE_META = {
  pdf: { label: 'PDF', icon: FileText, tone: 'text-rose-600 bg-rose-50' },
  on_demand_video: { label: 'Video', icon: Video, tone: 'text-indigo-600 bg-indigo-50' },
  live_class: { label: 'Live', icon: Radio, tone: 'text-emerald-600 bg-emerald-50' },
  linked_document: { label: 'Doc Link', icon: FileText, tone: 'text-amber-600 bg-amber-50' },
};

export default function SubmitLibraryBatchDialog({
  open, onClose, onConfirm, onApproveSelf, listedClasses, allClasses, curriculums, busy, curriculumName,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  // Default to the classes with pending changes whenever the dialog opens or
  // the listed set changes. The admin can then expand the selection with
  // "Select all" or narrow it by unchecking individual rows.
  useEffect(() => {
    if (open) setSelectedIds(listedClasses.filter((c) => c.pending_library_update).map((c) => c.id));
  }, [open, listedClasses]);

  const allSelected = listedClasses.length > 0 && selectedIds.length === listedClasses.length;
  const selectedClasses = listedClasses.filter((c) => selectedIds.includes(c.id));
  const pendingCount = listedClasses.filter((c) => c.pending_library_update).length;

  // Affected curricula are derived from the live selection: a selected class
  // affects every curriculum whose copies reference it as their library master.
  const affectedCurricula = useMemo(() => {
    const ids = new Set();
    selectedClasses.forEach((pc) => {
      (allClasses || []).forEach((c) => {
        if (c.library_class_id === pc.id && c.curriculum_id) ids.add(c.curriculum_id);
      });
    });
    return (curriculums || []).filter((c) => ids.has(c.id));
  }, [selectedClasses, allClasses, curriculums]);

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAll() {
    setSelectedIds(allSelected ? [] : listedClasses.map((c) => c.id));
  }

  const sectionTitle = curriculumName
    ? `Classes in ${curriculumName} (${listedClasses.length})`
    : `Changed classes (${listedClasses.length})`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-600" /> Submit Library Updates for Review
          </DialogTitle>
          <DialogDescription>
            The changes below will be sent to each affected curriculum's approver. Each curriculum
            rolls out independently once its approver approves.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Library className="h-3.5 w-3.5" /> {sectionTitle}
              </div>
              {listedClasses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
            {listedClasses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                {curriculumName
                  ? 'No classes found in this curriculum.'
                  : 'No pending library changes to submit.'}
              </div>
            ) : (
              <div className="max-h-[240px] space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {listedClasses.map((c) => {
                  const meta = TYPE_META[c.content_type] || TYPE_META.pdf;
                  const Icon = meta.icon;
                  const checked = selectedIds.includes(c.id);
                  const pending = !!c.pending_library_update;
                  return (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
                        checked ? 'bg-indigo-50/70' : 'bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(c.id)}
                        className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      <Icon className={`h-4 w-4 ${meta.tone.split(' ')[0]}`} />
                      <span className="flex-1 truncate text-sm font-medium text-slate-900">{c.title}</span>
                      {pending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600">
                          <RefreshCw className="h-3 w-3" /> Changed
                        </span>
                      )}
                      {c.has_quiz && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-1.5 py-0.5 text-xs text-purple-700">
                          <HelpCircle className="h-3 w-3" /> Quiz
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {curriculumName && listedClasses.length > 0 && (
              <p className="mt-1.5 text-xs text-slate-400">
                {pendingCount} class{pendingCount === 1 ? '' : 'es'} with pending changes. Select all or choose specific classes to include.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <BookOpen className="h-3.5 w-3.5" /> Affected curricula ({affectedCurricula.length})
            </div>
            {affectedCurricula.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-700">
                {selectedClasses.length === 0
                  ? 'Select at least one class to see affected curricula.'
                  : 'None of these classes are used in any curriculum yet. The batch will be recorded with no review requests.'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {affectedCurricula.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    <BookOpen className="h-3 w-3" /> {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <DialogClose asChild><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button></DialogClose>
          {onApproveSelf && <ApproveMyselfButton busy={busy} disabled={selectedClasses.length === 0} onConfirm={() => onApproveSelf(selectedClasses)} />}
          <Button onClick={() => onConfirm(selectedClasses)} disabled={busy || selectedClasses.length === 0}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Submit {affectedCurricula.length > 0 ? `to ${affectedCurricula.length} reviewer${affectedCurricula.length === 1 ? '' : 's'}` : 'batch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}