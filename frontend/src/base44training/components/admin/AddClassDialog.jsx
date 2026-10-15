import React, { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import ClassFormFields, { buildEmptyClassData } from './ClassFormFields';

export default function AddClassDialog({ open, onClose, onSave, uploading, onUploadFile, curriculums, isTitleTaken }) {
  const [data, setData] = useState(buildEmptyClassData());
  const titleTaken = !!(isTitleTaken && isTitleTaken(data.title));

  function reset() {
    setData(buildEmptyClassData());
  }

  function close() {
    reset();
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
      // keep legacy single-date field in sync with the first timing
      live_class_date: data.content_type === 'live_class' && data.available_timings[0] ? data.available_timings[0] : '',
    };
    const result = await onSave(payload);
    if (result !== false) reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Class to Library</DialogTitle>
        </DialogHeader>
        <ClassFormFields data={data} setData={setData} uploading={uploading} onUploadFile={onUploadFile} curriculums={curriculums} />
        {titleTaken && <p className="text-sm text-rose-600">A class named "{data.title.trim()}" already exists in the library. Use a different name.</p>}
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-b44-background px-6 py-3">
          <DialogClose asChild><Button variant="outline" onClick={close}>Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={!data.title || titleTaken || (data.content_type === 'linked_document' && !data.document_id)}>Add to Library</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}