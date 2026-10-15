import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { base44 } from '../base44Client';
import { Button } from './ui/button';

// Shows the CURRENT published version of the Documents-module document a class links to.
export default function LinkedDocumentView({ documentId, fallbackTitle }) {
  const [state, setState] = useState({ loading: true, doc: null });

  useEffect(() => {
    let cancelled = false;
    if (!documentId) { setState({ loading: false, doc: null }); return undefined; }
    base44.documents.latest(documentId)
      .then((doc) => { if (!cancelled) setState({ loading: false, doc }); })
      .catch(() => { if (!cancelled) setState({ loading: false, doc: null }); });
    return () => { cancelled = true; };
  }, [documentId]);

  if (state.loading) return <div className="p-12 text-center text-sm text-slate-400">Loading document…</div>;
  if (!state.doc) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        {documentId ? `${fallbackTitle ? `"${fallbackTitle}" ` : 'This class\'s linked document '}isn't published yet.` : 'No document linked to this class yet.'}
      </div>
    );
  }
  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileText className="h-6 w-6" /></div>
        <div>
          <div className="font-semibold text-slate-900">{state.doc.title}</div>
          <div className="text-sm text-slate-500">Version {state.doc.version} · updates automatically when republished</div>
        </div>
      </div>
      <a href={`/document/${state.doc.id}?view=reference`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex">
        <Button><ExternalLink className="mr-1.5 h-4 w-4" /> Open Document</Button>
      </a>
    </div>
  );
}
