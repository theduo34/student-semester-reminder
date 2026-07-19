// Local-timezone YYYY-MM-DD, built from date components — never toISOString(), which
// is UTC and can shift the calendar day near midnight relative to what the user (and
// react-native-calendars, which also keys off local time) actually sees. Any screen
// that maps an epoch-ms timestamp to "which calendar day is this" (Calendar today,
// Home/Alerts later) uses this same helper — a second implementation is exactly how
// this bug reappears somewhere else.
export function toDateKey(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
