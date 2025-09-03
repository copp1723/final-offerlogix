import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface SendWindow {
  tz: string;
  start: string; // HH:mm
  end: string; // HH:mm
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function canSend(now: Date, window?: SendWindow | null): boolean {
  if (!window) return true;
  const zoned = toZonedTime(now, window.tz);
  const minutes = zoned.getHours() * 60 + zoned.getMinutes();
  const start = parseTime(window.start);
  const end = parseTime(window.end);
  if (start <= end) {
    return minutes >= start && minutes < end;
  }
  // window crosses midnight
  return minutes >= start || minutes < end;
}

export function nextSendTime(now: Date, window?: SendWindow | null): Date {
  if (!window) return now;
  if (canSend(now, window)) return now;
  const zoned = toZonedTime(now, window.tz);
  const minutes = zoned.getHours() * 60 + zoned.getMinutes();
  const start = parseTime(window.start);
  const next = new Date(zoned);
  if (minutes < start) {
    next.setHours(Math.floor(start / 60), start % 60, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(Math.floor(start / 60), start % 60, 0, 0);
  }
  return fromZonedTime(next, window.tz);
}

export function getDefaultSendWindow(): SendWindow | null {
  const env = process.env.DEFAULT_SEND_WINDOW;
  if (!env) return null;
  try {
    const parsed = JSON.parse(env);
    if (parsed && typeof parsed.tz === 'string') {
      return parsed as SendWindow;
    }
  } catch {}
  return null;
}