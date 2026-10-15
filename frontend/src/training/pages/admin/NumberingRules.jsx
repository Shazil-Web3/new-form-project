import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { EmptyState, PageHeader } from '../../components/common';
import { ConfirmModal } from '../../components/Modal';
import Modal from '../../components/Modal';
import { trainingService } from '../../store';
import { ui } from '../../theme';

const ENTITY_LABELS = { field_specialty: 'Field Specialty', curriculum: 'Curriculum' };
const DIGIT_OPTIONS = [7, 8, 9];

function previewCode(prefix, digitLength, currentCounter) {
  const cleanPrefix = (prefix || 'ABC').trim().toUpperCase() || 'ABC';
  const next = (Number(currentCounter) || 0) + 1;
  return `${cleanPrefix}-${String(next).padStart(Number(digitLength) || 8, '0')}`;
}

function RuleFormModal({ open, initial, existingTypes, onClose, onSave }) {
  const [values, setValues] = useState({ entity_type: 'field_specialty', prefix: '', digit_length: 8, current_counter: 0, status: 'active' });

  useEffect(() => {
    if (!open) return;
    const firstFreeType = Object.keys(ENTITY_LABELS).find((type) => !existingTypes.includes(type)) || 'field_specialty';
    setValues(
      initial
        ? { entity_type: initial.entity_type, prefix: initial.prefix, digit_length: initial.digit_length, current_counter: initial.current_counter, status: initial.status }
        : { entity_type: firstFreeType, prefix: '', digit_length: 8, current_counter: 0, status: 'active' }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (patch) => setValues((current) => ({ ...current, ...patch }));
  const availableTypes = Object.keys(ENTITY_LABELS).filter((type) => initial || !existingTypes.includes(type));
  const prefixValid = /^[A-Za-z]{3,4}$/.test(values.prefix.trim());

  return (
    <Modal open={open} title={initial ? 'Edit numbering rule' : 'New numbering rule'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!prefixValid) return;
          onSave({ ...values, prefix: values.prefix.trim().toUpperCase() });
        }}
      >
        <div className="space-y-4">
          <div>
            <label className={ui.label}>Target</label>
            <select className={ui.input} value={values.entity_type} onChange={(event) => set({ entity_type: event.target.value })} disabled={Boolean(initial)}>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={ui.label}>Prefix (3-4 letters)</label>
              <input className={ui.input} value={values.prefix} onChange={(event) => set({ prefix: event.target.value })} placeholder="e.g. FIN" autoFocus />
            </div>
            <div>
              <label className={ui.label}>Digit length (7-9)</label>
              <select className={ui.input} value={values.digit_length} onChange={(event) => set({ digit_length: Number(event.target.value) })}>
                {DIGIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} digits ({'0'.repeat(n)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={ui.label} htmlFor="current-counter">
              Current counter (starting value)
            </label>
            <input
              id="current-counter"
              type="number"
              min="0"
              className={ui.input}
              value={values.current_counter}
              onChange={(event) => set({ current_counter: event.target.value })}
            />
          </div>
          <div>
            <label className={ui.label}>Status</label>
            <select className={ui.input} value={values.status} onChange={(event) => set({ status: event.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Live format preview</span>
            <div className="mt-1 font-mono text-base font-semibold text-violet-700">{previewCode(values.prefix, values.digit_length, values.current_counter)}</div>
            <span className="text-xs text-slate-400">(next generated number)</span>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ui.btnLight}>
            Cancel
          </button>
          <button type="submit" disabled={!prefixValid} className={ui.btnDark}>
            {initial ? 'Save changes' : 'Create Rule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function NumberingRules() {
  const [rules, setRules] = useState(null);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => trainingService.fetchNumberingRules().then(setRules).catch(() => message.error('Could not load numbering rules'));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={ui.page}>
      <PageHeader
        title="Numbering Rules"
        subtitle="Auto-generate reference codes (e.g. FIN-00000001) the same way the Document Admin's Numbering tab does."
        action={
          <button type="button" className={ui.btnDark} onClick={() => setModal({ mode: 'create' })}>
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Numbering Rule
          </button>
        }
      />

      <div className={`${ui.card} mt-6 overflow-hidden`}>
        {!rules ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Prefix</th>
                <th className="px-4 py-2.5">Digits</th>
                <th className="px-4 py-2.5">Next number</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{ENTITY_LABELS[rule.entity_type] || rule.entity_type}</td>
                  <td className="px-4 py-2.5 text-slate-600">{rule.prefix}</td>
                  <td className="px-4 py-2.5 text-slate-600">{rule.digit_length}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{previewCode(rule.prefix, rule.digit_length, rule.current_counter)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${rule.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {rule.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setModal({ mode: 'edit', item: rule })} className={ui.iconBtn} aria-label={`Edit ${rule.entity_type} rule`}>
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(rule)}
                        className={`${ui.iconBtn} hover:text-red-600`}
                        aria-label={`Delete ${rule.entity_type} rule`}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rules && rules.length === 0 ? <EmptyState icon="tag" message="No numbering rules configured yet. Click 'Add Numbering Rule' to create one." /> : null}
      </div>

      <RuleFormModal
        open={Boolean(modal)}
        initial={modal?.item}
        existingTypes={(rules || []).map((rule) => rule.entity_type)}
        onClose={() => setModal(null)}
        onSave={async (values) => {
          try {
            if (modal.mode === 'edit') await trainingService.updateNumberingRule(modal.item.id, values);
            else await trainingService.saveNumberingRule(values);
            message.success(modal.mode === 'edit' ? 'Rule updated' : 'Rule created');
            setModal(null);
            load();
          } catch (error) {
            message.error(error?.response?.data?.error || 'Could not save the rule');
          }
        }}
      />

      <ConfirmModal
        open={Boolean(confirm)}
        title="Delete numbering rule?"
        message={confirm ? `Future ${ENTITY_LABELS[confirm.entity_type] || confirm.entity_type} records will no longer get an auto-generated code.` : ''}
        onConfirm={async () => {
          await trainingService.deleteNumberingRule(confirm.id);
          message.success('Rule deleted');
          setConfirm(null);
          load();
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
