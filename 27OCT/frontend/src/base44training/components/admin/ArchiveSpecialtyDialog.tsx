import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { Archive } from 'lucide-react';
import ApproveMyselfButton from './ApproveMyselfButton';

export default function ArchiveSpecialtyDialog({ specialty, onClose, onConfirm, onApproveSelf }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!specialty;

  useEffect(() => {
    if (specialty) setReason('');
  }, [specialty]);

  async function submit() {
    if (!specialty) return;
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  async function submitSelf() {
    if (!specialty) return;
    if (!reason.trim()) return;
    await onApproveSelf(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Archive className="h-4 w-4" /> Archive specialty</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Request to archive <strong>{specialty?.name}</strong>? A manager will review and approve it before the specialty is archived.
          </p>
          <p className="text-xs text-slate-500">
            On approval, published curriculums under this specialty are archived, and any unpublished (draft) curriculums and their content are moved to trash.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="archive-spec-reason">Reason for archiving <span className="text-b44-destructive">*</span></Label>
            <Textarea
              id="archive-spec-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Domain discontinued, consolidated into another specialty…"
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