import React from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import DocumentPicker from './DocumentPicker';

export function buildEmptyClassData() {
  return {
    title: '',
    description: '',
    content_type: 'pdf',
    type: 'required',
    content_url: '',
    document_id: '',
    document_title: '',
    live_class_link: '',
    available_timings: [],
    duration_minutes: 0,
    certificate_validity_months: '',
    retraining_interval_months: '',
    has_quiz: false,
    curriculum_ids: [],
  };
}

export default function ClassFormFields({ data, setData, uploading, onUploadFile, curriculums }) {
  function addTiming() {
    setData((d) => ({ ...d, available_timings: [...d.available_timings, ''] }));
  }
  function updateTiming(i, val) {
    setData((d) => {
      const next = [...d.available_timings];
      next[i] = val;
      return { ...d, available_timings: next };
    });
  }
  function removeTiming(i) {
    setData((d) => ({ ...d, available_timings: d.available_timings.filter((_, idx) => idx !== i) }));
  }

  return (
    <div className="space-y-4">
      <Field label="Title">
        <Input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} rows={2} />
      </Field>
      <Field label="Content Type">
        <Select value={data.content_type} onValueChange={(v) => setData({ ...data, content_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF Document</SelectItem>
            <SelectItem value="on_demand_video">On-Demand Video</SelectItem>
            <SelectItem value="live_class">Live Class</SelectItem>
            <SelectItem value="linked_document">Linked Document</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Training Type">
        <Select value={data.type} onValueChange={(v) => setData({ ...data, type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="required">Required</SelectItem>
            <SelectItem value="elective">Elective</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {data.content_type === 'pdf' && (
        <Field label="PDF File">
          <div className="flex items-center gap-2">
            <Input type="file" accept="application/pdf" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await onUploadFile(file);
              setData({ ...data, content_url: url });
            }} />
            {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
          </div>
          {data.content_url && <p className="mt-1 truncate text-xs text-emerald-600">Uploaded: {data.content_url}</p>}
        </Field>
      )}
      {data.content_type === 'on_demand_video' && (
        <Field label="Video URL">
          <Input value={data.content_url} onChange={(e) => setData({ ...data, content_url: e.target.value })} placeholder="https://…" />
        </Field>
      )}
      {data.content_type === 'linked_document' && (
        <Field label="Document">
          <DocumentPicker value={data.document_id} onChange={(id, doc) => setData({ ...data, document_id: id, document_title: doc?.title || '' })} />
        </Field>
      )}
      {data.content_type === 'live_class' && (
        <>
          <Field label="Available Timings">
            <div className="space-y-2">
              {data.available_timings.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={t ? t.slice(0, 16) : ''}
                    onChange={(e) => updateTiming(i, e.target.value)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeTiming(i)} type="button">
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTiming} type="button">
                <Plus className="mr-1.5 h-4 w-4" /> Add a time
              </Button>
            </div>
          </Field>
          <Field label="Meeting Link">
            <Input value={data.live_class_link} onChange={(e) => setData({ ...data, live_class_link: e.target.value })} placeholder="https://meet…" />
          </Field>
        </>
      )}
      <Field label="Duration (min)">
        <Input type="number" value={data.duration_minutes} onChange={(e) => setData({ ...data, duration_minutes: e.target.value })} />
      </Field>
      <Field label="Certificate validity (months)">
        <Input type="number" min="0" value={data.certificate_validity_months ?? ''} onChange={(e) => setData({ ...data, certificate_validity_months: e.target.value })} placeholder="Blank = never expires" />
      </Field>
      <Field label="Retraining interval (months)">
        <Input type="number" min="0" value={data.retraining_interval_months ?? ''} onChange={(e) => setData({ ...data, retraining_interval_months: e.target.value })} placeholder="Blank = never required" />
      </Field>
      {curriculums && curriculums.length > 0 && (
        <Field label="Place in Curricula (optional)">
          <p className="mb-2 text-xs text-slate-400">A linked copy is added to each selected curriculum. Specialties are inferred from the curricula.</p>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
            {curriculums.map((c) => {
              const checked = (data.curriculum_ids || []).includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setData((d) => {
                    const ids = d.curriculum_ids || [];
                    return {
                      ...d,
                      curriculum_ids: ids.includes(c.id)
                        ? ids.filter((id) => id !== c.id)
                        : [...ids, c.id],
                    };
                  })}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                    {checked && <Plus className="hidden" />}
                    {checked && <span className="text-xs text-white">✓</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.field_specialty_name || '—'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={data.has_quiz} onChange={(e) => setData({ ...data, has_quiz: e.target.checked })} className="rounded" />
        Include a quiz
      </label>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}