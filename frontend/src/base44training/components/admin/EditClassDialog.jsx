import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import ClassFormFields, { buildEmptyClassData } from './ClassFormFields';

export default function EditClassDialog({ open, cls, onClose, onSave, uploading, onUploadFile, isTitleTaken }) {
  const [data, setData] = useState(buildEmptyClassData());
  const [note, setNote] = useState('');
  const [initialized, setInitialized] = useState(false);
  // Only library classes need a unique name; copies keep their parent's name.
  const titleTaken = !!(cls && !cls.library_class_id && isTitleTaken && isTitleTaken(data.title, cls.id));

  // Initialize form when a class is provided
  if (open && cls && !initialized) {
    setData({
      title: cls.title || '',
      description: cls.description || '',
      content_type: cls.content_type || 'pdf',
      type: cls.type || 'required',
      content_url: cls.content_url || '',
      document_id: cls.document_id || '',
      document_title: cls.document_title || '',
      live_class_link: cls.live_class_link || '',
      available_timings: cls.available_timings || [],
      duration_minutes: cls.duration_minutes || 0,
      certificate_validity_months: cls.certificate_validity_months ?? '',
      retraining_interval_months: cls.retraining_interval_months ?? '',
      has_quiz: !!cls.has_quiz,
    });
    setNote('');
    setInitialized(true);
  }
  if (!open && initialized) setInitialized(false);

  function close() {
    setInitialized(false);
    onClose();
  }

  async function submit() {
    if (!data.title || titleTaken || (data.content_type === 'linked_document' && !data.document_id)) return;
    const payload = {
      ...data,
      duration_minutes: Number(data.duration_minutes) || 0,
      certificate_validity_months: data.certificate_validity_months === '' || data.certificate_validity_months == null ? null : Number(data.certificate_validity_months),
      retraining_interval_months: data.retraining_interval_months === '' || data.retraining_interval_months == null ? null : Number(data.retraining_interval_months),
      available_timings: data.available_timings.filter(Boolean),
      live_class_date: data.content_type === 'live_class' && data.available_timings[0] ? data.available_timings[0] : '',
    };
    const result = await onSave(cls, payload, note.trim());
    if (result !== false) setInitialized(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Library Class</DialogTitle>
        </DialogHeader>
        <ClassFormFields data={data} setData={setData} uploading={uploading} onUploadFile={onUploadFile} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Revision Note (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated slides for 2026" />
        </div>
        {titleTaken && <p className="text-sm text-rose-600">A class named "{data.title.trim()}" already exists in the library. Use a different name.</p>}
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-b44-background px-6 py-3">
          <DialogClose asChild><Button variant="outline" onClick={close}>Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={!data.title || titleTaken || (data.content_type === 'linked_document' && !data.document_id)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}