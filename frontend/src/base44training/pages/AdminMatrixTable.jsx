/* eslint-disable no-restricted-globals */ // native confirm() kept as in the Base44 original
import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Send, Table2, Pencil } from 'lucide-react';
import AssignMatrixDialog from '../components/admin/AssignMatrixDialog';

const audienceMeta = {
  new_hire: { label: 'New Hire', cls: 'bg-sky-50 text-sky-700' },
  career_advancement: { label: 'Career Advancement', cls: 'bg-violet-50 text-violet-700' },
  general: { label: 'General', cls: 'bg-slate-100 text-slate-600' },
};

const typeMeta = {
  specialty: { label: 'Specialty', cls: 'bg-indigo-50 text-indigo-700' },
  curriculum: { label: 'Curriculum', cls: 'bg-emerald-50 text-emerald-700' },
  class: { label: 'Class', cls: 'bg-amber-50 text-amber-700' },
};

export default function AdminMatrixTable() {
  const [user, setUser] = useState(null);
  const [matrices, setMatrices] = useState([]);
  const [items, setItems] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [classes, setClasses] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newAudience, setNewAudience] = useState('new_hire');
  const [assignTarget, setAssignTarget] = useState(null);
  const [addType, setAddType] = useState('curriculum');
  const [addId, setAddId] = useState('');

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      await reloadAll();
      setLoading(false);
    })();
  }, []);

  async function reloadAll() {
    const [m, it, c, cl, sp, u] = await Promise.all([
      base44.entities.TrainingMatrix.list(),
      base44.entities.MatrixItem.list(),
      base44.entities.Curriculum.list(),
      base44.entities.Class.list(),
      base44.entities.FieldSpecialty.list(),
      base44.entities.User.list(),
    ]);
    setMatrices(m);
    setItems(it);
    setCurricula(c);
    setClasses(cl);
    setSpecialties(sp);
    setUsers(u);
  }

  async function createMatrix() {
    if (!newName.trim()) return;
    await base44.entities.TrainingMatrix.create({ name: newName, audience: newAudience });
    setNewName('');
    setNewAudience('new_hire');
    await reloadAll();
  }

  async function deleteMatrix(id) {
    if (!confirm('Delete this matrix and all its items?')) return;
    await base44.entities.MatrixItem.deleteMany({ matrix_id: id });
    await base44.entities.TrainingMatrix.delete(id);
    if (selectedId === id) setSelectedId(null);
    await reloadAll();
  }

  async function addItem() {
    const matrix = matrices.find((m) => m.id === selectedId);
    if (!matrix || !addId) return;
    let payload = { matrix_id: matrix.id, matrix_name: matrix.name, item_type: addType, order: items.filter((i) => i.matrix_id === selectedId).length };
    if (addType === 'specialty') {
      const s = specialties.find((x) => x.id === addId);
      payload = { ...payload, specialty_id: s.id, specialty_name: s.name };
    } else if (addType === 'curriculum') {
      const c = curricula.find((x) => x.id === addId);
      payload = { ...payload, curriculum_id: c.id, curriculum_name: c.name };
    } else {
      const cl = classes.find((x) => x.id === addId);
      payload = { ...payload, curriculum_id: cl.curriculum_id, curriculum_name: cl.curriculum_name, class_id: cl.id, class_name: cl.title };
    }
    await base44.entities.MatrixItem.create(payload);
    setAddId('');
    await reloadAll();
  }

  async function removeItem(itemId) {
    await base44.entities.MatrixItem.delete(itemId);
    await reloadAll();
  }

  const addOptions = useMemo(() => {
    const existing = new Set(items.filter((i) => i.matrix_id === selectedId).map((i) => `${i.item_type}:${i.specialty_id || i.curriculum_id || i.class_id}`));
    if (addType === 'specialty') return specialties.filter((s) => !existing.has(`specialty:${s.id}`)).map((s) => ({ value: s.id, label: s.name }));
    if (addType === 'curriculum') return curricula.filter((c) => !existing.has(`curriculum:${c.id}`)).map((c) => ({ value: c.id, label: c.name }));
    return classes.filter((c) => !existing.has(`class:${c.id}`)).map((c) => ({ value: c.id, label: c.title }));
  }, [addType, selectedId, items, specialties, curricula, classes]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }
  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  const selected = matrices.find((m) => m.id === selectedId);
  const selectedItems = items.filter((i) => i.matrix_id === selectedId).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Training Matrix — Table</h1>
        <p className="text-sm text-slate-500">Manage reusable training plans in a compact table layout.</p>
      </div>

      {/* New matrix row */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New matrix name…" className="flex-1" />
        <Select value={newAudience} onValueChange={setNewAudience}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new_hire">New Hire</SelectItem>
            <SelectItem value="career_advancement">Career Advancement</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={createMatrix} disabled={!newName.trim()}><Plus className="mr-1.5 h-4 w-4" /> Create</Button>
      </div>

      {/* Matrices table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Matrix</TableHead>
              <TableHead className="w-[150px]">Audience</TableHead>
              <TableHead className="w-[80px] text-right">Items</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrices.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">No matrices yet. Create one above.</TableCell></TableRow>
            )}
            {matrices.map((m) => {
              const count = items.filter((i) => i.matrix_id === m.id).length;
              const am = audienceMeta[m.audience] || audienceMeta.new_hire;
              const open = selectedId === m.id;
              return (
                <React.Fragment key={m.id}>
                  <TableRow className={open ? 'bg-slate-50' : 'hover:bg-slate-50'}>
                    <TableCell>
                      <button onClick={() => setSelectedId(open ? null : m.id)} className="text-slate-400 hover:text-slate-700">
                        {open ? '▾' : '▸'}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                    <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${am.cls}`}>{am.label}</span></TableCell>
                    <TableCell className="text-right text-sm text-slate-600">{count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setAssignTarget(m)} disabled={count === 0}><Send className="mr-1 h-3.5 w-3.5" /> Assign</Button>
                        <button onClick={() => deleteMatrix(m.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="bg-slate-50/60">
                      <TableCell colSpan={5} className="p-4">
                        <ItemTable
                          items={selectedItems}
                          onRemove={removeItem}
                          addType={addType}
                          setAddType={(t) => { setAddType(t); setAddId(''); }}
                          addId={addId}
                          setAddId={setAddId}
                          addOptions={addOptions}
                          onAdd={addItem}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AssignMatrixDialog
        open={!!assignTarget}
        onOpenChange={(o) => { if (!o) setAssignTarget(null); }}
        matrix={assignTarget}
        items={assignTarget ? items.filter((i) => i.matrix_id === assignTarget.id) : []}
        curricula={curricula}
        users={users}
        assignedById={user?.id}
        onDone={reloadAll}
      />
    </div>
  );
}

function ItemTable({ items, onRemove, addType, setAddType, addId, setAddId, addOptions, onAdd }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-[200px]">Parent</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">No items yet. Add one below.</TableCell></TableRow>
          )}
          {items.map((it, idx) => {
            const tm = typeMeta[it.item_type];
            const name = it.item_type === 'specialty' ? it.specialty_name : it.item_type === 'curriculum' ? it.curriculum_name : it.class_name;
            const parent = it.item_type === 'class' ? it.curriculum_name : '—';
            return (
              <TableRow key={it.id}>
                <TableCell className="text-sm text-slate-400">{idx + 1}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tm.cls}`}>{tm.label}</span></TableCell>
                <TableCell className="font-medium text-slate-900">{name}</TableCell>
                <TableCell className="text-sm text-slate-500">{parent}</TableCell>
                <TableCell>
                  <button onClick={() => onRemove(it.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </TableCell>
              </TableRow>
            );
          })}
          {/* Add row */}
          <TableRow className="bg-slate-50">
            <TableCell></TableCell>
            <TableCell>
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="specialty">Specialty</SelectItem>
                  <SelectItem value="curriculum">Curriculum</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={addId} onValueChange={setAddId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {addOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell></TableCell>
            <TableCell>
              <Button size="icon" onClick={onAdd} disabled={!addId}><Plus className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}