import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Send, FolderTree, BookOpen, FileText } from 'lucide-react';

const audienceMeta = {
  new_hire: { label: 'New Hire', cls: 'bg-sky-50 text-sky-700' },
  career_advancement: { label: 'Career Advancement', cls: 'bg-violet-50 text-violet-700' },
  general: { label: 'General', cls: 'bg-slate-100 text-slate-600' },
};

const typeMeta = {
  specialty: { label: 'Specialty', icon: FolderTree, cls: 'bg-indigo-50 text-indigo-700' },
  curriculum: { label: 'Curriculum', icon: BookOpen, cls: 'bg-emerald-50 text-emerald-700' },
  class: { label: 'Class', icon: FileText, cls: 'bg-amber-50 text-amber-700' },
};

export default function MatrixBuilder({ matrix, items, specialties, curricula, classes, onAddItem, onRemoveItem, onAssign }) {
  const [specId, setSpecId] = useState('');
  const [curId, setCurId] = useState('');
  const [classId, setClassId] = useState('');

  const am = audienceMeta[matrix.audience] || audienceMeta.new_hire;
  const addedKeys = new Set(items.map((i) => `${i.item_type}:${i.specialty_id || i.curriculum_id || i.class_id}`));

  function addSpecialty() {
    const s = specialties.find((x) => x.id === specId);
    if (!s) return;
    onAddItem({ matrix_id: matrix.id, matrix_name: matrix.name, item_type: 'specialty', specialty_id: s.id, specialty_name: s.name, order: items.length });
    setSpecId('');
  }
  function addCurriculum() {
    const c = curricula.find((x) => x.id === curId);
    if (!c) return;
    onAddItem({ matrix_id: matrix.id, matrix_name: matrix.name, item_type: 'curriculum', curriculum_id: c.id, curriculum_name: c.name, order: items.length });
    setCurId('');
  }
  function addClass() {
    const cl = classes.find((x) => x.id === classId);
    if (!cl) return;
    onAddItem({ matrix_id: matrix.id, matrix_name: matrix.name, item_type: 'class', curriculum_id: cl.curriculum_id, curriculum_name: cl.curriculum_name, class_id: cl.id, class_name: cl.title, order: items.length });
    setClassId('');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{matrix.name}</h2>
          {matrix.description && <p className="text-sm text-slate-500">{matrix.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${am.cls}`}>{am.label}</span>
          <Button onClick={() => onAssign(matrix)} disabled={items.length === 0}>
            <Send className="mr-1.5 h-4 w-4" /> Assign to employee
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
        <AddRow label="Add specialty" placeholder="Select specialty…" value={specId} onChange={setSpecId} onAdd={addSpecialty} options={specialties.filter((s) => !addedKeys.has(`specialty:${s.id}`)).map((s) => ({ value: s.id, label: s.name }))} />
        <AddRow label="Add curriculum" placeholder="Select curriculum…" value={curId} onChange={setCurId} onAdd={addCurriculum} options={curricula.filter((c) => !addedKeys.has(`curriculum:${c.id}`)).map((c) => ({ value: c.id, label: c.name }))} />
        <AddRow label="Add class" placeholder="Select class…" value={classId} onChange={setClassId} onAdd={addClass} options={classes.filter((c) => !addedKeys.has(`class:${c.id}`)).map((c) => ({ value: c.id, label: c.title }))} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Matrix contents ({items.length})</p>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No items yet. Add specialties, curricula, or classes above.</div>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => {
              const tm = typeMeta[it.item_type];
              const Icon = tm.icon;
              const name = it.item_type === 'specialty' ? it.specialty_name : it.item_type === 'curriculum' ? it.curriculum_name : it.class_name;
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${tm.cls}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                    {it.item_type === 'class' && it.curriculum_name && <p className="truncate text-xs text-slate-400">{it.curriculum_name}</p>}
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tm.cls}`}>{tm.label}</span>
                  <button onClick={() => onRemoveItem(it.id)} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AddRow({ label, placeholder, value, onChange, onAdd, options }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={onAdd} disabled={!value} size="icon"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}