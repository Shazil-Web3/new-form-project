import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// "Linked Document" class content: pick a published document from the Documents module.
export default function DocumentPicker({ value, onChange }) {
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.documents.published().then((d) => { if (!cancelled) setDocs(d); }).catch(() => { if (!cancelled) setDocs([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <Select value={value || ''} onValueChange={(v) => onChange(v, (docs || []).find((d) => d.document_id === v))}>
        <SelectTrigger><SelectValue placeholder={docs === null ? 'Loading documents…' : 'Select a published document…'} /></SelectTrigger>
        <SelectContent>
          {(docs || []).map((d) => (
            <SelectItem key={d.document_id} value={d.document_id}>{d.title} (v{d.version})</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-slate-400">Always shows that document's current published version, and updates automatically when it is revised.</p>
      {docs !== null && docs.length === 0 && <p className="mt-1 text-xs text-amber-600">No published documents found.</p>}
    </div>
  );
}
