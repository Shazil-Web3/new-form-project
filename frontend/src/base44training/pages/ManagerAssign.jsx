import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser, addWeeks, toISODate, formatDate, REQUIRED_WEEKS } from '../lib/training';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { ClipboardList, Calendar, Users, CheckCircle2 } from 'lucide-react';

export default function ManagerAssign() {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [dueDate, setDueDate] = useState(toISODate(addWeeks(new Date(), REQUIRED_WEEKS)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const [employees, curs] = await Promise.all([
        base44.entities.User.filter({ manager_id: me.id }),
        base44.entities.Curriculum.list(),
      ]);
      setTeam(employees);
      setCurriculums(curs);
      setLoading(false);
    })();
  }, []);

  async function assign() {
    setSaving(true);
    setSuccess(false);
    const cur = curriculums.find((c) => c.id === selectedCurriculum);
    for (const empId of selectedEmployees) {
      const emp = team.find((e) => e.id === empId);
      await base44.entities.Assignment.create({
        employee_id: empId,
        employee_name: emp?.full_name || emp?.email || '',
        manager_id: user.id,
        curriculum_id: cur.id,
        curriculum_name: cur.name,
        assignment_type: cur.type || 'required',
        assigned_by_id: user.id,
        due_date: dueDate,
        status: 'assigned',
        extensions_used: 0,
      });
    }
    setSaving(false);
    setSuccess(true);
    setSelectedEmployees([]);
    setSelectedCurriculum('');
    setDueDate(toISODate(addWeeks(new Date(), REQUIRED_WEEKS)));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'manager' && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  const toggleEmployee = (id) => {
    setSelectedEmployees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Assign Training</h1>
        <p className="text-sm text-slate-500">Select team members and a curriculum. Required training defaults to a 2-week deadline.</p>
      </div>

      {team.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">You don't have any team members yet. Ask an admin to assign employees to you as their manager.</p>
        </div>
      ) : (
        <>
          <div>
            <Label className="mb-2 block text-sm font-medium text-slate-700">Select team members</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {team.map((e) => (
                <button
                  key={e.id}
                  onClick={() => toggleEmployee(e.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selectedEmployees.includes(e.id) ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {(e.full_name || e.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{e.full_name || 'Unnamed'}</p>
                    <p className="truncate text-xs text-slate-500">{e.email}</p>
                  </div>
                  {selectedEmployees.includes(e.id) && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-slate-700">Curriculum</Label>
              <Select value={selectedCurriculum} onValueChange={setSelectedCurriculum}>
                <SelectTrigger><SelectValue placeholder="Choose a curriculum…" /></SelectTrigger>
                <SelectContent>
                  {curriculums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.type === 'elective' ? '(Elective)' : '(Required)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-slate-700">
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Due date</span>
              </Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">Default: {formatDate(addWeeks(new Date(), REQUIRED_WEEKS))} (2 weeks from today)</p>
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Training assigned successfully.
            </div>
          )}

          <Button
            onClick={assign}
            disabled={selectedEmployees.length === 0 || !selectedCurriculum || saving}
            className="w-full"
          >
            <ClipboardList className="mr-1.5 h-4 w-4" />
            {saving ? 'Assigning…' : `Assign to ${selectedEmployees.length} ${selectedEmployees.length === 1 ? 'employee' : 'employees'}`}
          </Button>
        </>
      )}
    </div>
  );
}