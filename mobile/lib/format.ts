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
