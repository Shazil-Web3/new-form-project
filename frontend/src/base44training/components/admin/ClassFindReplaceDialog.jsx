/* eslint-disable no-restricted-globals */ // native confirm() kept as in the Base44 original
import React, { useMemo, useState } from 'react';
import { base44 } from '../../base44Client';
import { Button } from '../ui/button';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { Trash2, ArrowLeftRight, FileText, Video, Radio } from 'lucide-react';

const contentTypeMeta = {
  pdf: { label: 'PDF', icon: FileText },
  on_demand_video: { label: 'Video', icon: Video },
  live_class: { label: 'Live', icon: Radio },
  linked_document: { label: 'Doc Link', icon: FileText },
};

export default function ClassFindReplaceDialog({ open, onOpenChange, classes, curriculums, specialties, onDone }) {
  const [findTitle, setFindTitle] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [substituteId, setSubstituteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const curById = useMemo(() => Object.fromEntries(curriculums.map((c) => [c.id, c])), [curriculums]);
  const specById = useMemo(() => Object.fromEntries(specialties.map((s) => [s.id, s])), [specialties]);

  const distinctTitles = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const c of classes) {
      const key = c.title?.trim();
      if (key && !seen.has(key)) { seen.add(key); out.push(key); }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const matches = useMemo(() => {
    if (!findTitle) return [];
    return classes.filter((c) => c.title === findTitle);
  }, [classes, findTitle]);

  const allSelected = matches.length > 0 && matches.every((m) => selected.has(m.id));
  const selectedClasses = matches.filter((m) => selected.has(m.id));
  const count = selectedClasses.length;

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (matches.every((m) => prev.has(m.id))) {
        matches.forEach((m) => next.delete(m.id));
      } else {
        matches.forEach((m) => next.add(m.id));
      }
      return next;
    });
  }

  function reset() {
    setFindTitle('');
    setSelected(new Set());
    setSubstituteId('');
    setMessage('');
  }

  async function removeSelected() {
    if (!count) return;
    if (!confirm(`Remove ${count} class${count !== 1 ? 'es' : ''}? Classes in published curriculums are staged for deletion pending approval.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const affectedCur = new Set();
      let staged = 0;
      let direct = 0;
      for (const cl of selectedClasses) {
        const cur = curById[cl.curriculum_id];
        const isPublished = cur?.status === 'published';
        if (isPublished && cl.pending_operation !== 'add') {
          // Stage the deletion — it goes live once the curriculum re-publish is approved.
          await base44.entities.Class.update(cl.id, { pending_operation: 'delete' });
          affectedCur.add(cl.curriculum_id);
          staged++;
        } else {
          // Draft curriculum, or a not-yet-approved added class: remove outright.
          await base44.entities.Class.delete(cl.id);
          direct++;
        }
      }
      for (const cid of affectedCur) {
        await base44.entities.Curriculum.update(cid, { has_unpublished_changes: true });
      }
      const parts = [];
      if (staged) parts.push(`${staged} staged for deletion (pending approval)`);
      if (direct) parts.push(`${direct} removed`);
      setMessage(parts.length ? `${parts.join(' · ')}.` : 'Nothing to remove.');
      setSelected(new Set());
      onDone();
    } catch (e) {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function substituteSelected() {
    if (!count || !substituteId) return;
    const replacement = classes.find((c) => c.id === substituteId);
    if (!replacement) return;
    if (selected.has(substituteId)) {
      setMessage('Pick a different class to substitute with.');
      return;
    }
    if (!confirm(`Replace ${count} class${count !== 1 ? 'es' : ''} with "${replacement.title}"? Classes in published curriculums are staged pending approval.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const affectedCur = new Set();
      let staged = 0;
      let direct = 0;
      for (const cl of selectedClasses) {
        const cur = curById[cl.curriculum_id];
        const isPublished = cur?.status === 'published';
        const newClassBase = {
          title: replacement.title,
          description: replacement.description,
          curriculum_id: cl.curriculum_id,
          curriculum_name: cl.curriculum_name,
          type: cl.type || 'required',
          content_type: replacement.content_type,
          content_url: replacement.content_url || '',
          document_id: replacement.document_id || '',
          document_title: replacement.document_title || '',
          live_class_date: replacement.live_class_date || '',
          live_class_link: replacement.live_class_link || '',
          duration_minutes: replacement.duration_minutes || 0,
          order: cl.order ?? 0,
          has_quiz: false,
        };
        if (isPublished) {
          // Stage the replacement as a pending add and the old class for deletion;
          // both go live once the curriculum re-publish is approved.
          await base44.entities.Class.create({ ...newClassBase, pending_operation: 'add' });
          if (cl.pending_operation === 'add') {
            await base44.entities.Class.delete(cl.id);
          } else {
            await base44.entities.Class.update(cl.id, { pending_operation: 'delete' });
          }
          affectedCur.add(cl.curriculum_id);
          staged++;
        } else {
          await base44.entities.Class.create(newClassBase);
          await base44.entities.Class.delete(cl.id);
          direct++;
        }
      }
      for (const cid of affectedCur) {
        await base44.entities.Curriculum.update(cid, { has_unpublished_changes: true });
      }
      const parts = [];
      if (staged) parts.push(`${staged} staged (pending approval)`);
      if (direct) parts.push(`${direct} substituted`);
      setMessage(parts.length ? `${parts.join(' · ')}.` : 'Nothing changed.');
      setSelected(new Set());
      setSubstituteId('');
      onDone();
    } catch (e) {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find & Replace Classes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={findTitle} onValueChange={(v) => { setFindTitle(v); setSelected(new Set()); setMessage(''); }}>
            <SelectTrigger><SelectValue placeholder="Select a class to find…" /></SelectTrigger>
            <SelectContent>
              {distinctTitles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          {findTitle && (
            <>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  {matches.length} match{matches.length !== 1 ? 'es' : ''} · select all
                </label>
                <span className="text-sm text-slate-500">{count} selected</span>
              </div>

              <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200">
                {matches.map((cl) => {
                  const cur = curById[cl.curriculum_id];
                  const spec = cur ? specById[cur.field_specialty_id] : null;
                  const Meta = contentTypeMeta[cl.content_type];
                  const Icon = Meta?.icon || FileText;
                  return (
                    <label key={cl.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                      <input type="checkbox" checked={selected.has(cl.id)} onChange={() => toggleOne(cl.id)} />
                      <Icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{cl.title}</p>
                        <p className="truncate text-xs text-slate-500">{spec?.name || '—'} › {cur?.name || '—'}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-slate-400">{Meta?.label}</span>
                    </label>
                  );
                })}
                {matches.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No classes found for "{findTitle}".</p>}
              </div>

              {count > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <Select value={substituteId} onValueChange={setSubstituteId}>
                      <SelectTrigger><SelectValue placeholder="Substitute with another class…" /></SelectTrigger>
                      <SelectContent>
                        {classes.filter((c) => !selected.has(c.id)).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={substituteSelected} disabled={busy || !substituteId} variant="outline">
                    <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Substitute
                  </Button>
                  <Button onClick={removeSelected} disabled={busy} variant="destructive">
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                  </Button>
                </div>
              )}

              {message && <p className="text-sm text-slate-600">{message}</p>}
            </>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}