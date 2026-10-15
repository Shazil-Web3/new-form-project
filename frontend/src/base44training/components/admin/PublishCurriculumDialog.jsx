import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { Send } from 'lucide-react';
import ApproveMyselfButton from './ApproveMyselfButton';

export default function PublishCurriculumDialog({ curriculum, onClose, onConfirm, onApproveSelf }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!curriculum;

  useEffect(() => {
    if (curriculum) setReason('');
  }, [curriculum]);

  async function submit() {
    if (!curriculum) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  async function submitSelf() {
    if (!curriculum) return;
    await onApproveSelf(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Publish curriculum</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Request to publish <strong>{curriculum?.name}</strong>? A manager will review and approve it before the curriculum goes live — or approve it yourself.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="publish-reason">Notes for the reviewer (optional)</Label>
            <Textarea
              id="publish-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Ready for rollout, reviewed by SME…"
              rows={3}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <DialogClose asChild><Button variant="outline" onClick={onClose}>Cancel</Button></DialogClose>
          {onApproveSelf && <ApproveMyselfButton onConfirm={submitSelf} busy={busy} />}
          <Button onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send for review'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}