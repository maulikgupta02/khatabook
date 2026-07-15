export function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

// All mobile numbers are stored with the 91 (India) country code prefix -- WhatsApp's
// Cloud API needs the full number in `to`, and this keeps every stored/sent value in one
// consistent format instead of prefixing at send time. The app only ever collects the
// 10-digit local number from the user and adds/strips the prefix at the boundary.
const COUNTRY_CODE = '91';

export function isValidLocalMobile(local: string) {
  return /^\d{10}$/.test(local);
}

export function toStoredMobile(local: string) {
  return `${COUNTRY_CODE}${local}`;
}

// Legacy-safe: numbers saved before the 91-prefix convention won't have it, so this
// only strips when the stored value actually has the expected 12-digit 91-prefixed shape.
export function fromStoredMobile(stored: string) {
  return stored.startsWith(COUNTRY_CODE) && stored.length === 12 ? stored.slice(2) : stored;
}

export function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength);
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
