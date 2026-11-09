import React from 'react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { formatDateTime } from '../../lib/training';

export default function PublishPendingWarningDialog({ warning, onClose, onWithdraw }) {
  const open = !!warning;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Already sent for approval
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            <strong>{warning?.curriculum_name}</strong> already has a publish request waiting for manager review.
          </p>
          <p className="text-sm text-slate-600">
            It was sent on <strong>{warning?.sent_on ? formatDateTime(warning.sent_on) : '—'}</strong>
            {warning?.requested_by_name ? ` by ${warning.requested_by_name}` : ''}.
          </p>
          <p className="text-sm text-slate-500">
            You can't send it again until that request is approved or rejected.
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline" onClick={onWithdraw} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              Withdraw request
            </Button>
          </DialogClose>
          <DialogClose asChild><Button onClick={onClose}>Got it</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}