export function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDaysOfWeek(days: number[]) {
  if (days.length === 7) return 'Every day';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ');
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthIso() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatMonth(monthIso: string) {
  const [year, month] = monthIso.slice(0, 7).split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatDate(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}
