export const ui = {
  page: 'mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-10',
  narrow: 'mx-auto w-full max-w-4xl px-6 py-8 sm:px-10',
  title: 'text-2xl font-semibold tracking-tight text-slate-900',
  subtitle: 'mt-1 text-sm text-slate-500',
  card: 'rounded-2xl border border-slate-200 bg-white',
  btnDark:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
  btnLight:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  btnTint:
    'inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100',
  btnDanger:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700',
  iconBtn:
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700',
  input:
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-600 focus:ring-1 focus:ring-violet-600',
  label: 'mb-1.5 block text-sm font-medium text-slate-700',
  link: 'inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900',
};

export const TONES = {
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
};

export const CONTENT_TYPES = {
  pdf: { label: 'PDF Document', short: 'PDF', icon: 'description', tone: 'amber' },
  video: { label: 'On-Demand Video', short: 'Video', icon: 'videocam', tone: 'amber' },
  live: { label: 'Live Class', short: 'Live', icon: 'sensors', tone: 'amber' },
  document: { label: 'Document (Word/PPT/Excel/Image)', short: 'Document', icon: 'attach_file', tone: 'amber' },
  linked_document: { label: 'Linked Document (from Documents module)', short: 'Doc Link', icon: 'link', tone: 'amber' },
};

export const QUESTION_TYPES = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  fill_blank: 'Fill in the Blank',
  matching: 'Matching',
};
