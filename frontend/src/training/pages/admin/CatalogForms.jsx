import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { trainingService } from '../../store';
import { CONTENT_TYPES, ui } from '../../theme';

function SectionHeading({ children }) {
  return <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>;
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className={ui.label}>{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function FormFooter({ onClose, submitLabel, disabled, submitting }) {
  return (
    <>
      <button type="button" onClick={onClose} className={ui.btnLight}>
        Cancel
      </button>
      <button type="submit" disabled={disabled || submitting} className={ui.btnDark}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </>
  );
}

// Shows the save error right inside the modal (not just a toast) so it is impossible to
// miss — a form that silently does nothing on failure looks broken even when it isn't.
function FormModal({ open, title, onClose, onSubmit, submitLabel, disabled, children, width }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  return (
    <Modal open={open} title={title} onClose={onClose} width={width}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (disabled || submitting) return;
          setSubmitting(true);
          setError('');
          try {
            await onSubmit();
          } catch (err) {
            setError(err?.response?.data?.error || 'Could not save. Please try again.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="space-y-4">{children}</div>
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <FormFooter onClose={onClose} submitLabel={submitLabel} disabled={disabled} submitting={submitting} />
        </div>
      </form>
    </Modal>
  );
}

export function SpecialtyFormModal({ open, initial, onClose, onSave }) {
  const [values, setValues] = useState({ name: '', description: '' });

  useEffect(() => {
    if (open) setValues({ name: initial?.name || '', description: initial?.description || '' });
  }, [open, initial]);

  return (
    <FormModal
      open={open}
      title={initial ? 'Edit specialty' : 'New specialty'}
      onClose={onClose}
      onSubmit={() => onSave(values)}
      submitLabel={initial ? 'Save changes' : 'Create specialty'}
      disabled={!values.name.trim()}
    >
      <Field label="Name">
        <input className={ui.input} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="e.g. CloudSafety" autoFocus />
      </Field>
      <Field label="Description">
        <textarea className={ui.input} rows={3} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
      </Field>
      {initial?.code ? (
        <Field label="Code" hint="Auto-generated from the Numbering Rules setting; goes up a revision each time you save changes.">
          <input className={ui.input} value={`${initial.code} · rev ${initial.revision}`} disabled />
        </Field>
      ) : null}
    </FormModal>
  );
}

export function CurriculumFormModal({ open, initial, onClose, onSave }) {
  const [values, setValues] = useState({ name: '', description: '', type: 'required' });

  useEffect(() => {
    if (open) setValues({ name: initial?.name || '', description: initial?.description || '', type: initial?.type || 'required' });
  }, [open, initial]);

  return (
    <FormModal
      open={open}
      title={initial ? 'Edit curriculum' : 'New curriculum'}
      onClose={onClose}
      onSubmit={() => onSave(values)}
      submitLabel={initial ? 'Save changes' : 'Create curriculum'}
      disabled={!values.name.trim()}
    >
      <Field label="Name">
        <input className={ui.input} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} autoFocus />
      </Field>
      <Field label="Description">
        <textarea className={ui.input} rows={3} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
      </Field>
      <Field label="Training Type" hint="Required curricula are assigned by managers. Electives can be joined by students.">
        <select className={ui.input} value={values.type} onChange={(event) => setValues({ ...values, type: event.target.value })}>
          <option value="required">Required</option>
          <option value="elective">Elective</option>
        </select>
      </Field>
      {initial?.code ? (
        <Field label="Code" hint="Auto-generated from the Numbering Rules setting; goes up a revision each time you save changes.">
          <input className={ui.input} value={`${initial.code} · rev ${initial.revision}`} disabled />
        </Field>
      ) : null}
    </FormModal>
  );
}

const emptyClass = (curriculumType) => ({
  title: '',
  description: '',
  content_type: 'pdf',
  training_type: curriculumType || 'required',
  content_url: '',
  content_name: '',
  live_class_date: '',
  live_class_link: '',
  duration_minutes: 0,
  order: 0,
  has_quiz: false,
  prerequisite_class_id: '',
  certificate_validity_months: '',
  retraining_interval_months: '',
  document_id: '',
});

// Two steps instead of one long scroll — keeps every step short enough to fit without
// cutting off the Create button when the browser is zoomed in (e.g. 90%+).
function StepTabs({ step }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs font-semibold">
      <span className={step === 1 ? 'text-violet-700' : 'text-slate-400'}>1. Basic &amp; Content</span>
      <span className="text-slate-300">&rarr;</span>
      <span className={step === 2 ? 'text-violet-700' : 'text-slate-400'}>2. Rules &amp; Scheduling</span>
    </div>
  );
}

export function ClassFormModal({ open, initial, curriculumType, siblingClasses, onClose, onSave }) {
  const [values, setValues] = useState(emptyClass(curriculumType));
  const [publishedDocuments, setPublishedDocuments] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPendingFile(null);
    setStep(1);
    setError('');
    setSubmitting(false);
    if (!initial) return setValues(emptyClass(curriculumType));
    setValues({
      ...emptyClass(curriculumType),
      ...initial,
      prerequisite_class_id: initial.prerequisite_class_id || '',
      certificate_validity_months: initial.certificate_validity_months || '',
      retraining_interval_months: initial.retraining_interval_months || '',
      document_id: initial.document_id || '',
    });
  }, [open, initial, curriculumType]);

  useEffect(() => {
    if (!open) return;
    trainingService.fetchPublishedDocuments().then(setPublishedDocuments).catch(() => setPublishedDocuments([]));
  }, [open]);

  const set = (patch) => setValues((current) => ({ ...current, ...patch }));

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    set({ content_name: file.name });
  };

  const step1Valid = Boolean(values.title.trim()) && !(values.content_type === 'linked_document' && !values.document_id);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const savedId = await onSave({ ...values, duration_minutes: Number(values.duration_minutes) || 0, order: Number(values.order) || 0 });
      const classId = savedId || initial?.id;
      if (pendingFile && classId) await trainingService.uploadClassContent(classId, pendingFile);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Edit class' : 'New class'} onClose={onClose} width="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <StepTabs step={step} />

        {step === 1 ? (
          <div className="space-y-4">
            <SectionHeading>Basic Info</SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input className={ui.input} value={values.title} onChange={(event) => set({ title: event.target.value })} autoFocus />
              </Field>
              <Field label="Training Type">
                <select className={ui.input} value={values.training_type} onChange={(event) => set({ training_type: event.target.value })}>
                  <option value="required">Required</option>
                  <option value="elective">Elective</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea className={ui.input} rows={2} value={values.description} onChange={(event) => set({ description: event.target.value })} />
            </Field>

            <SectionHeading>Content</SectionHeading>
            <Field label="Content Type">
              <select className={ui.input} value={values.content_type} onChange={(event) => set({ content_type: event.target.value })}>
                {Object.entries(CONTENT_TYPES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </Field>

            {values.content_type === 'pdf' ? (
              <Field label="PDF File" hint={values.content_name ? `Selected: ${values.content_name}` : 'Uploads when you save the class.'}>
                <input type="file" accept="application/pdf" onChange={onFile} className={`${ui.input} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium`} />
              </Field>
            ) : null}
            {values.content_type === 'document' ? (
              <Field label="Document File" hint={values.content_name ? `Selected: ${values.content_name}` : 'Word, PowerPoint, Excel, or an image file.'}>
                <input
                  type="file"
                  accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.pdf"
                  onChange={onFile}
                  className={`${ui.input} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium`}
                />
              </Field>
            ) : null}
            {values.content_type === 'linked_document' ? (
              <Field label="Document" hint="Always shows that document's current PUBLISHED version — updates automatically when it's revised.">
                <select className={ui.input} value={values.document_id} onChange={(event) => set({ document_id: event.target.value })}>
                  <option value="">Select a published document…</option>
                  {publishedDocuments.map((doc) => (
                    <option key={doc.document_id} value={doc.document_id}>
                      {doc.title} (v{doc.version})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {values.content_type === 'video' ? (
              <Field label="Video URL" hint="Paste a link to the video (YouTube, Vimeo or a direct file).">
                <input className={ui.input} value={values.content_url} onChange={(event) => set({ content_url: event.target.value })} placeholder="https://" />
              </Field>
            ) : null}
            {values.content_type === 'live' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Live Class Date">
                  <input type="datetime-local" className={ui.input} value={values.live_class_date} onChange={(event) => set({ live_class_date: event.target.value })} />
                </Field>
                <Field label="Live Class Link">
                  <input className={ui.input} value={values.live_class_link} onChange={(event) => set({ live_class_link: event.target.value })} placeholder="https://" />
                </Field>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <SectionHeading>Rules &amp; Scheduling</SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration (min)">
                <input type="number" min="0" className={ui.input} value={values.duration_minutes} onChange={(event) => set({ duration_minutes: event.target.value })} />
              </Field>
              <Field label="Order">
                <input type="number" min="0" className={ui.input} value={values.order} onChange={(event) => set({ order: event.target.value })} />
              </Field>
              <Field label="Certificate validity" hint="Blank = never expires.">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Never expires"
                    className={ui.input}
                    value={values.certificate_validity_months}
                    onChange={(event) => set({ certificate_validity_months: event.target.value })}
                  />
                  <span className="flex-none text-sm text-slate-400">months</span>
                </div>
              </Field>
              <Field label="Retraining interval" hint="Blank = never required.">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Never"
                    className={ui.input}
                    value={values.retraining_interval_months}
                    onChange={(event) => set({ retraining_interval_months: event.target.value })}
                  />
                  <span className="flex-none text-sm text-slate-400">months</span>
                </div>
              </Field>
            </div>

            {siblingClasses?.length ? (
              <Field label="Prerequisite" hint="Employees must complete this class before they can access this one.">
                <select className={ui.input} value={values.prerequisite_class_id} onChange={(event) => set({ prerequisite_class_id: event.target.value })}>
                  <option value="">None</option>
                  {siblingClasses
                    .filter((entry) => entry.id !== initial?.id)
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title}
                      </option>
                    ))}
                </select>
              </Field>
            ) : null}

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={values.has_quiz} onChange={(event) => set({ has_quiz: event.target.checked })} className="rounded border-slate-300 text-violet-700 focus:ring-violet-600" />
              Include a quiz
            </label>
          </div>
        )}

        {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ui.btnLight}>
            Cancel
          </button>
          {step === 2 ? (
            <button type="button" onClick={() => setStep(1)} className={ui.btnLight}>
              Back
            </button>
          ) : null}
          {step === 1 ? (
            <button type="button" disabled={!step1Valid} onClick={() => setStep(2)} className={ui.btnDark}>
              Next
            </button>
          ) : (
            <button type="submit" disabled={submitting} className={ui.btnDark}>
              {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create class'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
