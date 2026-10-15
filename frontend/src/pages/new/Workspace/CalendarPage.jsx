import React from 'react';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import GanttHome from '../../../base44gantt/pages/GanttHome';

// Calendar page: hosts the Base44 Gantt / Calendar / Workload UI (frontend/src/base44gantt),
// wired to this app's backend through base44gantt/base44Client.js.
export default function CalendarPage() {
  return (
    <MainLayout showSearch={false} fullWidth hideTopbar>
      <GanttHome />
    </MainLayout>
  );
}
