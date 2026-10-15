import React from 'react';
import './theme.css';
import { Toaster } from './components/ui/toaster';

// Frame for the copied SkillStream pages: same content padding as Base44's Layout <main>, plus the toaster.
export default function B44Page({ children }) {
  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 lg:px-8 lg:py-8">
      {children}
      <Toaster />
    </div>
  );
}
