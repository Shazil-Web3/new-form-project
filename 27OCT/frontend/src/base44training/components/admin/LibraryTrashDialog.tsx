import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Trash2, RotateCcw } from 'lucide-react';

const TYPE_LABEL = {
  pdf: 'PDF',
  on_demand_video: 'Video',
  live_class: 'Live',
  linked_document: 'Doc Link',
};

function autoDeleteDate(trashedAt) {
  if (!trashedAt) return '—';
  const d = new Date(trashedAt);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LibraryTrashDialog({ open, trashed, busy, onClose, onRestore }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-slate-500" />
            Admin Trash
          </DialogTitle>
          <DialogDescription>
            Classes here are hidden from the library. They are permanently deleted
            automatically 30 days after being trashed.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200">
          {trashed.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">Trash is empty.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Auto-deletes</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trashed.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{c.title}</td>
                    <td className="px-4 py-2.5 text-slate-600">{TYPE_LABEL[c.content_type] || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{autoDeleteDate(c.trashed_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRestore(c)}
                        disabled={busy}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}