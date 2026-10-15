import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { ShieldAlert } from 'lucide-react';

const opLabel = (op, targetType) => {
  if (targetType === 'quiz') return 'quiz update';
  return op === 'add' ? 'new class' : op === 'delete' ? 'class removal' : 'class edit';
};

export default function ChangeRequestDialog({ change, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!change;

  useEffect(() => {
    if (change) setReason('');
  }, [change]);

  async function submit() {
    if (!change) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <ShieldAlert className="h-4 w-4" /> Approval required
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{change?.curriculum_name}</strong> is published. This {change ? opLabel(change.operation, change.target_type) : 'change'} ({change?.class_title || 'quiz'}) won't take effect until a manager approves it.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="change-reason">Reason for the change (optional)</Label>
            <Textarea
              id="change-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Updated content, corrected typo…"
              rows={3}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" onClick={onClose}>Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send for approval'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}