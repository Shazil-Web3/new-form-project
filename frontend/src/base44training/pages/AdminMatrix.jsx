/* eslint-disable no-restricted-globals */ // native confirm() kept as in the Base44 original
import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash2, LayoutGrid } from 'lucide-react';
import MatrixBuilder from '../components/admin/MatrixBuilder';
import AssignMatrixDialog from '../components/admin/AssignMatrixDialog';

const audienceMeta = {
  new_hire: { label: 'New Hire', cls: 'bg-sky-50 text-sky-700' },
  career_advancement: { label: 'Career Advancement', cls: 'bg-violet-50 text-violet-700' },
  general: { label: 'General', cls: 'bg-slate-100 text-slate-600' },
};

export default function AdminMatrix() {
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
  const [newDesc, setNewDesc] = useState('');
  const [newAudience, setNewAudience] = useState('new_hire');
  const [assignTarget, setAssignTarget] = useState(null);

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
    await base44.entities.TrainingMatrix.create({ name: newName, description: newDesc, audience: newAudience });
    setNewName('');
    setNewDesc('');
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

  async function addItem(payload) {
    await base44.entities.MatrixItem.create(payload);
    await reloadAll();
  }

  async function removeItem(itemId) {
    await base44.entities.MatrixItem.delete(itemId);
    await reloadAll();
  }

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
        <h1 className="text-xl font-semibold text-slate-900">Training Matrix</h1>
        <p className="text-sm text-slate-500">Build reusable training plans for new hires or career advancement, then assign a whole plan to an employee.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">New matrix</h2>
            <div className="space-y-3">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Matrix name (e.g. New Hire — Sales)" />
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
              <Select value={newAudience} onValueChange={setNewAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_hire">New Hire</SelectItem>
                  <SelectItem value="career_advancement">Career Advancement</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={createMatrix} disabled={!newName.trim()} className="w-full">
                <Plus className="mr-1.5 h-4 w-4" /> Create matrix
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {matrices.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No matrices yet.</div>
            )}
            {matrices.map((m) => {
              const count = items.filter((i) => i.matrix_id === m.id).length;
              const am = audienceMeta[m.audience] || audienceMeta.new_hire;
              return (
                <div key={m.id} className={`rounded-xl border bg-white p-3 transition ${selectedId === m.id ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}>
                  <button onClick={() => setSelectedId(m.id)} className="block w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{m.name}</span>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${am.cls}`}>{am.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{count} item{count !== 1 ? 's' : ''}</p>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => deleteMatrix(m.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {selected ? (
            <MatrixBuilder
              matrix={selected}
              items={selectedItems}
              specialties={specialties}
              curricula={curricula}
              classes={classes}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onAssign={(mx) => setAssignTarget(mx)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><LayoutGrid className="h-6 w-6" /></div>
              <p className="text-sm font-medium text-slate-700">Select a matrix to build</p>
              <p className="text-sm text-slate-500">or create a new one on the left.</p>
            </div>
          )}
        </div>
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