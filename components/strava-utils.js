export const dayMs = 24 * 60 * 60 * 1000;

export function localDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfWeek(date) {
  const copy = new Date(date);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
}

export function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

export function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1, 12);
}

export function formatDistance(value) {
  return `${value.toFixed(1)} km`;
}

export function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(localDate(dateString));
}
