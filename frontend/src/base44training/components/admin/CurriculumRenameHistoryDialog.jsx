import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { ArrowRight, History } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Lightweight rename history for a curriculum, separate from full curriculum revisions.
export default function CurriculumRenameHistoryDialog({ curriculum, onClose }) {
  const [renames, setRenames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!curriculum) return;
    (async () => {
      setLoading(true);
      try {
        const page = await base44.entities.CurriculumRename.filter(
          { curriculum_id: curriculum.id },
          { sort: '-created_date', limit: 100 }
        );
        setRenames(page.items || page);
      } catch {
        setRenames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [curriculum]);

  return (
    <Dialog open={!!curriculum} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            Rename History — {curriculum?.name || ''}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          </div>
        ) : renames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            This curriculum has never been renamed.
          </div>
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {renames.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-500 line-through">{r.old_name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium text-slate-900">{r.new_name}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                  <span>{r.changed_by_name || '—'}</span>
                  <span>{formatDate(r.created_date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogClose asChild><Button variant="outline" onClick={onClose}>Close</Button></DialogClose>
      </DialogContent>
    </Dialog>
  );
}