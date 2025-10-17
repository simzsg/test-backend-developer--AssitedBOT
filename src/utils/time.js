export function startOfMinute(date = new Date()) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}