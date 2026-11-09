import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';

export default function ConfirmTrashClassDialog({ open, cls, busy, onClose, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            Move class to trash?
          </DialogTitle>
          <DialogDescription>
            This class has not been approved yet. Moving it to the trash removes it from the
            library and any curricula it was placed in. It will be permanently deleted
            automatically after 30 days. You can restore it from the trash before then.
          </DialogDescription>
        </DialogHeader>
        {cls && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{cls.title}</span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            {busy ? 'Moving…' : 'Move to trash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}