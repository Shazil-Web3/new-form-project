import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { History, FileText, Video, Radio, Clock, Link as LinkIcon } from 'lucide-react';

const TYPE_ICON = { pdf: FileText, on_demand_video: Video, live_class: Radio, linked_document: FileText };

function formatLiveDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ClassRevisionHistoryDialog({ cls, onClose }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cls) return;
    (async () => {
      setLoading(true);
      const res = await base44.entities.ClassRevision.filter(
        { class_id: cls.id },
        { sort: '-revision_number', limit: 100 }
      );
      setRevisions(res.items || res);
      setLoading(false);
    })();
  }, [cls]);

  return (
    <Dialog open={!!cls} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            Revision History — {cls?.title}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : revisions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No revisions recorded yet.</div>
        ) : (
          <div className="max-h-[460px] space-y-3 overflow-y-auto">
            {revisions.map((r) => {
              const s = r.snapshot || {};
              const Icon = TYPE_ICON[s.content_type] || FileText;
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        Rev {r.revision_number}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{s.title}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(r.created_date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {r.change_note && (
                    <p className="mt-1.5 text-xs italic text-slate-500">"{r.change_note}"</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> {s.content_type}</span>
                    {s.duration_minutes > 0 && <span>{s.duration_minutes} min</span>}
                    {s.has_quiz && (s.quiz_snapshot ? (
                      <span className="text-purple-600">{(s.quiz_snapshot.questions || []).length} quiz questions</span>
                    ) : (
                      <span className="text-purple-600">Quiz included</span>
                    ))}
                    {s.available_timings && s.available_timings.length > 0 && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.available_timings.length} timing(s)</span>
                    )}
                  </div>
                  {(s.content_url || s.live_class_link) && (
                    <div className="mt-2 space-y-1">
                      {s.content_url && (
                        <a href={s.content_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline">
                          <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{s.content_url}</span>
                        </a>
                      )}
                      {s.live_class_link && (
                        <a href={s.live_class_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline">
                          <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{s.live_class_link}</span>
                        </a>
                      )}
                    </div>
                  )}
                  {r.changed_by_name && (
                    <p className="mt-1.5 text-xs text-slate-400">by {r.changed_by_name}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end">
          <DialogClose asChild><Button variant="outline" onClick={onClose}>Close</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}