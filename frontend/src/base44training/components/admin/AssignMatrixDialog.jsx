import React, { useMemo, useState } from 'react';
import { base44 } from '../../base44Client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Send } from 'lucide-react';

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

export default function AssignMatrixDialog({ open, onOpenChange, matrix, items, curricula, users, assignedById, onDone }) {
  const [employeeId, setEmployeeId] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const plan = useMemo(() => {
    const list = [];
    for (const it of items) {
      if (it.item_type === 'specialty') {
        curricula
          .filter((c) => c.field_specialty_id === it.specialty_id)
          .forEach((c) => list.push({ curriculum_id: c.id, curriculum_name: c.name, class_id: null, class_name: null, type: c.type || 'required' }));
      } else if (it.item_type === 'curriculum') {
        const c = curricula.find((x) => x.id === it.curriculum_id);
        list.push({ curriculum_id: it.curriculum_id, curriculum_name: it.curriculum_name, class_id: null, class_name: null, type: c?.type || 'required' });
      } else if (it.item_type === 'class') {
        list.push({ curriculum_id: it.curriculum_id, curriculum_name: it.curriculum_name, class_id: it.class_id, class_name: it.class_name, type: 'required' });
      }
    }
    return list;
  }, [items, curricula]);

  const employee = users.find((u) => u.id === employeeId);

  async function assign() {
    if (!employee || plan.length === 0) return;
    setBusy(true);
    try {
      const records = plan.map((p) => {
        const r = {
          employee_id: employee.id,
          employee_name: employee.full_name || employee.email,
          manager_id: assignedById,
          curriculum_id: p.curriculum_id,
          curriculum_name: p.curriculum_name,
          assignment_type: p.type === 'elective' ? 'elective' : 'required',
          assigned_by_id: assignedById,
          due_date: dueDate,
          status: 'assigned',
        };
        if (p.class_id) { r.class_id = p.class_id; r.class_name = p.class_name; }
        return r;
      });
      await base44.entities.Assignment.bulkCreate(records);
      setDone(true);
      onDone && onDone();
    } finally {
      setBusy(false);
    }
  }

  function close() {
    onOpenChange(false);
    setEmployeeId('');
    setDone(false);
    setDueDate(defaultDueDate());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign matrix: {matrix?.name}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Assigned {plan.length} training item{plan.length !== 1 ? 's' : ''} to {employee?.full_name || employee?.email}.
            </p>
            <DialogClose asChild><Button onClick={close} className="w-full">Done</Button></DialogClose>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                This will assign <strong>{plan.length}</strong> training item{plan.length !== 1 ? 's' : ''} to the selected employee.
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={assign} disabled={busy || !employeeId || plan.length === 0}>
                <Send className="mr-1.5 h-4 w-4" /> {busy ? 'Assigning…' : 'Assign training'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}