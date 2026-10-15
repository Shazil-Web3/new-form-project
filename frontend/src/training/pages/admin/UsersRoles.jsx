import React, { useState } from 'react';
import { message } from 'antd';
import { Avatar, PageHeader } from '../../components/common';
import Modal from '../../components/Modal';
import { trainingService, useTrainingState } from '../../store';
import { ui } from '../../theme';

const ROLE_LABELS = { administrator: 'Administrator', manager: 'Manager', employee: 'Student' };

function InviteModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [error, setError] = useState('');

  const close = () => {
    setEmail('');
    setRole('employee');
    setError('');
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    const result = await trainingService.inviteUser({ email, role });
    if (result.error) {
      setError(result.error);
      return;
    }
    message.success('Invitation sent');
    close();
  };

  return (
    <Modal open={open} title="Invite a new user" onClose={close}>
      <form onSubmit={submit}>
        <label htmlFor="invite-email" className={ui.label}>
          Email address
        </label>
        <input
          id="invite-email"
          type="email"
          required
          autoFocus
          className={ui.input}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
          placeholder="name@company.com"
        />
        <label htmlFor="invite-role" className={`${ui.label} mt-4`}>
          Role
        </label>
        <select id="invite-role" className={ui.input} value={role} onChange={(event) => setRole(event.target.value)}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-3 text-xs text-slate-400">An invitation email is sent. The user appears here as invited until they accept.</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} className={ui.btnLight}>
            Cancel
          </button>
          <button type="submit" disabled={!email.trim()} className={ui.btnDark}>
            Send invitation
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersRoles() {
  const state = useTrainingState();
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);

  const managers = state.users.filter((user) => user.role === 'manager');
  const needle = query.trim().toLowerCase();
  const users = state.users.filter((user) => !needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle));

  return (
    <div className={ui.page}>
      <PageHeader
        title="Users & Roles"
        subtitle="Assign roles, reporting managers, and invite new users to the platform."
        action={
          <button type="button" className={ui.btnDark} onClick={() => setInviting(true)}>
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Invite User
          </button>
        }
      />

      <label className="relative mt-6 block max-w-md">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users…"
          className={ui.input}
          style={{ paddingLeft: 40 }}
        />
      </label>

      <div className={`${ui.card} mt-6 overflow-hidden`}>
        <div className="hidden grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
          <div>User</div>
          <div>Role</div>
          <div>Reports to</div>
        </div>
        {users.map((user) => (
          <div key={user.id} className="grid gap-3 border-b border-slate-100 px-6 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_1fr] md:items-center md:gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size="h-9 w-9" tone="bg-slate-100 text-slate-600" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="truncate">{user.name}</span>
                  {user.status === 'invited' ? <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Invited</span> : null}
                </div>
                <div className="truncate text-xs text-slate-400">{user.email}</div>
              </div>
            </div>
            <div>
              {/* Role is set from Account Management, not here — this page only manages
                  the training reporting line (which manager a student is assigned to). */}
              <span className={`${ui.input} md:w-44 flex items-center text-slate-400`} title="Change roles from Account Management">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <div>
              {user.role === 'employee' ? (
                <select
                  value={user.reports_to || ''}
                  onChange={(event) => {
                    trainingService.setReportsTo(user.id, event.target.value);
                    message.success('Manager updated', 1.5);
                  }}
                  className={`${ui.input} md:w-44`}
                  aria-label={`Manager for ${user.name}`}
                >
                  <option value="">No manager</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 ? <div className="px-6 py-10 text-center text-sm text-slate-500">No users match your search.</div> : null}
      </div>

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
