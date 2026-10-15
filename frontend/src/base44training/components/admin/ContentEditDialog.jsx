import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import DocumentPicker from './DocumentPicker';

export default function ContentEditDialog({ editing, setEditing, uploading, onUploadFile, onSave }) {
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing?.data?.id ? 'Edit' : 'New'} {editing?.type === 'specialty' ? 'Field Specialty' : editing?.type === 'curriculum' ? 'Curriculum' : 'Class'}
          </DialogTitle>
        </DialogHeader>
        {editing && (
          <div className="space-y-4">
            {editing.type === 'specialty' && (
              <>
                <Field label="Name"><Input value={editing.data.name} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} /></Field>
                <Field label="Description"><Textarea value={editing.data.description} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} rows={3} /></Field>
              </>
            )}
            {editing.type === 'curriculum' && (
              <>
                <Field label="Name"><Input value={editing.data.name} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} /></Field>
                <Field label="Description"><Textarea value={editing.data.description} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} rows={3} /></Field>
                <Field label="Type">
                  <Select value={editing.data.type} onValueChange={(v) => setEditing({ ...editing, data: { ...editing.data, type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Required</SelectItem>
                      <SelectItem value="elective">Elective</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={editing.data.status || 'draft'} onValueChange={(v) => setEditing({ ...editing, data: { ...editing.data, status: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published" disabled>Published (via approval)</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            {editing.type === 'class' && (
              <>
                <Field label="Title"><Input value={editing.data.title} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, title: e.target.value } })} /></Field>
                <Field label="Description"><Textarea value={editing.data.description} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} rows={2} /></Field>
                <Field label="Content Type">
                  <Select value={editing.data.content_type} onValueChange={(v) => setEditing({ ...editing, data: { ...editing.data, content_type: v } })}>
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
                  <Select value={editing.data.type || 'required'} onValueChange={(v) => setEditing({ ...editing, data: { ...editing.data, type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Required</SelectItem>
                      <SelectItem value="elective">Elective</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {editing.data.content_type === 'pdf' && (
                  <Field label="PDF File">
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="application/pdf" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await onUploadFile(file);
                        setEditing({ ...editing, data: { ...editing.data, content_url: url } });
                      }} />
                      {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
                    </div>
                    {editing.data.content_url && <p className="mt-1 truncate text-xs text-emerald-600">Uploaded: {editing.data.content_url}</p>}
                  </Field>
                )}
                {editing.data.content_type === 'on_demand_video' && (
                  <Field label="Video URL"><Input value={editing.data.content_url} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, content_url: e.target.value } })} placeholder="https://…" /></Field>
                )}
                {editing.data.content_type === 'linked_document' && (
                  <Field label="Document">
                    <DocumentPicker value={editing.data.document_id} onChange={(id, doc) => setEditing({ ...editing, data: { ...editing.data, document_id: id, document_title: doc?.title || '' } })} />
                  </Field>
                )}
                {editing.data.content_type === 'live_class' && (
                  <>
                    <Field label="Live Class Date & Time"><Input type="datetime-local" value={editing.data.live_class_date ? editing.data.live_class_date.slice(0, 16) : ''} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, live_class_date: e.target.value } })} /></Field>
                    <Field label="Meeting Link"><Input value={editing.data.live_class_link} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, live_class_link: e.target.value } })} placeholder="https://meet…" /></Field>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Duration (min)"><Input type="number" value={editing.data.duration_minutes} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, duration_minutes: e.target.value } })} /></Field>
                  <Field label="Order"><Input type="number" value={editing.data.order} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, order: e.target.value } })} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={editing.data.has_quiz} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, has_quiz: e.target.checked } })} className="rounded" />
                  Include a quiz
                </label>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={onSave} disabled={!editing?.data?.name && !editing?.data?.title}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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