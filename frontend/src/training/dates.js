const pad = (value) => String(value).padStart(2, '0');

const parse = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const toDateStr = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayStr = () => toDateStr(new Date());

export const addDays = (value, days) => {
  const date = parse(value);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
};

export const daysUntil = (value) => Math.round((parse(value) - parse(todayStr())) / 86400000);

export const formatDate = (value) =>
  value ? parse(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const daysLeftLabel = (value) => {
  const days = daysUntil(value);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
};
