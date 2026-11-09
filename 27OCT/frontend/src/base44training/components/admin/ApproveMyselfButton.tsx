import React, { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

// "Approve myself": the admin approves their own request instead of sending it to a manager.
// A small warning window asks for confirmation first, because no one else will review it.
export default function ApproveMyselfButton({ onConfirm, disabled = false, busy = false, label = 'Approve myself', size = 'default', variant = 'outline' }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled || busy}>
        <ShieldCheck className="mr-1.5 h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!working) setOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Approve it yourself?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            No manager will review this. Once approved it goes live right away, and approved items can no longer be deleted — only archived.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={working}>Cancel</Button></DialogClose>
            <Button onClick={confirm} disabled={working}>{working ? 'Approving…' : 'Yes, approve'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
