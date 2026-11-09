import React, { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Send, ShieldCheck, AlertTriangle } from 'lucide-react';

// Replaces a plain confirm(): the admin either sends the request to a manager or approves it themselves.
// Two stacked option cards (no side-by-side buttons), so it never scrolls sideways.
export default function ApprovalChoiceDialog({ open, title, description, onClose, onSend, onApproveSelf }) {
  const [busy, setBusy] = useState(false);
  const [confirmSelf, setConfirmSelf] = useState(false);

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      setConfirmSelf(false);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setConfirmSelf(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md overflow-x-hidden">
        {!confirmSelf ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> {title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">{description}</p>
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(onSend)}
                className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-50"
              >
                <Send className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{busy ? 'Working…' : 'Send for review'}</span>
                  <span className="block text-xs text-slate-500">A manager reviews it in Tasks and approves or rejects.</span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmSelf(true)}
                className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40 disabled:opacity-50"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Approve myself</span>
                  <span className="block text-xs text-slate-500">Goes live right away, no manager review.</span>
                </span>
              </button>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={close} disabled={busy}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Approve it yourself?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              No manager will review this. Once approved it goes live right away, and approved items can no longer be deleted — only archived.
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => run(onApproveSelf)} disabled={busy}>{busy ? 'Approving…' : 'Yes, approve'}</Button>
              <Button className="w-full" variant="outline" onClick={() => setConfirmSelf(false)} disabled={busy}>Back</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
