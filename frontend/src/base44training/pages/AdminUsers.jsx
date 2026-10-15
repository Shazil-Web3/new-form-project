import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../components/ui/dialog';
import { Users, Shield, UserCog, Search, UserPlus } from 'lucide-react';

const roleMeta = {
  admin: { label: 'Administrator', icon: Shield, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  manager: { label: 'Manager', icon: UserCog, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  employee: { label: 'Employee', icon: Users, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

export default function AdminUsers() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const all = await base44.entities.User.list();
      setUsers(all);
      setManagers(all.filter((u) => u.role === 'manager'));
      setLoading(false);
    })();
  }, []);

  async function updateRole(u, role) {
    await base44.entities.User.update(u.id, { role });
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
    setManagers((prev) => (role === 'manager' ? [...prev.filter((m) => m.id !== u.id), { ...u, role }] : prev.filter((m) => m.id !== u.id)));
  }

  async function updateManager(u, managerId) {
    await base44.entities.User.update(u.id, { manager_id: managerId || null });
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, manager_id: managerId || null } : x)));
  }

  async function sendInvite() {
    setInviting(true);
    setInviteError('');
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      const all = await base44.entities.User.list();
      setUsers(all);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('employee');
    } catch (e) {
      setInviteError(e?.message || 'Could not send invitation.');
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  const filtered = users.filter((u) =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users & Roles</h1>
          <p className="text-sm text-slate-500">Assign roles, reporting managers, and invite new users to the platform.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Invite User
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="pl-9" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Reports To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((u) => {
              const RoleIcon = roleMeta[u.role]?.icon || Users;
              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                        {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {u.id === user?.id ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${roleMeta[u.role]?.tone}`}>
                        <RoleIcon className="h-3 w-3" /> {roleMeta[u.role]?.label}
                      </span>
                    ) : (
                      <Select value={u.role} onValueChange={(v) => updateRole(u, v)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {u.role === 'employee' ? (
                      <Select value={u.manager_id || 'none'} onValueChange={(v) => updateManager(u, v === 'none' ? '' : v)}>
                        <SelectTrigger className="w-44"><SelectValue placeholder="No manager" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No manager</SelectItem>
                          {managers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteError(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite a new user</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Email address</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-sm text-rose-600">{inviteError}</p>}
            <p className="text-xs text-slate-400">An invitation email will be sent. The user will appear here once they accept.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={sendInvite} disabled={!inviteEmail || inviting}>{inviting ? 'Sending…' : 'Send invitation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}