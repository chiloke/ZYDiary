export function $(selector) {
  return document.querySelector(selector);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return startOfDay(result);
}

export function diffDays(left, right) {
  return Math.round((startOfDay(right) - startOfDay(left)) / 86400000);
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimestamp(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}`;
}

export function formatDisplayDate(date) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${weekdays[date.getDay()]}`;
}

export function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function millisecondsUntil(target, date) {
  return Math.max(0, target - date);
}

export function timeUntilEndOfDay(date) {
  return millisecondsUntil(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1), date);
}

export function timeUntilEndOfMonth(date) {
  return millisecondsUntil(new Date(date.getFullYear(), date.getMonth() + 1, 1), date);
}

export function timeUntilEndOfYear(date) {
  return millisecondsUntil(new Date(date.getFullYear() + 1, 0, 1), date);
}

export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function shorten(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 48);
}
