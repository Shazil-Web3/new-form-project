import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { Archive } from 'lucide-react';
import ApproveMyselfButton from './ApproveMyselfButton';

export default function ArchiveCurriculumDialog({ curriculum, onClose, onConfirm, onApproveSelf }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!curriculum;

  useEffect(() => {
    if (curriculum) setReason('');
  }, [curriculum]);

  async function submit() {
    if (!curriculum) return;
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  async function submitSelf() {
    if (!curriculum) return;
    if (!reason.trim()) return;
    await onApproveSelf(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Archive className="h-4 w-4" /> Archive curriculum</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Request to archive <strong>{curriculum?.name}</strong>? A manager will review and approve it before the curriculum is archived.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="archive-reason">Reason for archiving <span className="text-b44-destructive">*</span></Label>
            <Textarea
              id="archive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Replaced by a new curriculum, content outdated…"
              rows={3}
              autoFocus
            />
            {!reason.trim() && (
              <p className="text-xs text-b44-muted-foreground">A reason is required before sending for manager approval.</p>
            )}
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <DialogClose asChild><Button variant="outline" onClick={onClose}>Cancel</Button></DialogClose>
          {onApproveSelf && <ApproveMyselfButton onConfirm={submitSelf} disabled={!reason.trim()} busy={busy} />}
          <Button onClick={submit} disabled={busy || !reason.trim()}>{busy ? 'Sending…' : 'Send for review'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}