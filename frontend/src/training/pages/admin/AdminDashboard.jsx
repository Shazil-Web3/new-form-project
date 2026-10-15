import React from 'react';
import { PageHeader, StatCard } from '../../components/common';
import { useTrainingContext } from '../../context';
import { useTrainingState } from '../../store';
import { ui } from '../../theme';

export default function AdminDashboard() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();

  return (
    <div className={ui.page}>
      <PageHeader title={`Welcome back, ${persona.name}`} subtitle="Manage your organization's training catalog and users." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="account_tree" tone="violet" value={state.fieldSpecialties.length} label="Field Specialties" />
        <StatCard icon="menu_book" tone="emerald" value={state.curriculums.length} label="Curriculums" />
        <StatCard icon="assignment" tone="amber" value={state.classes.length} label="Classes" />
        <StatCard icon="group" tone="slate" value={state.users.length} label="Users" />
      </div>
    </div>
  );
}
