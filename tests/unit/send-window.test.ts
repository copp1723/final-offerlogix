import { canSend, nextSendTime } from '../../shared/send-window';
import { fromZonedTime } from 'date-fns-tz';

describe('send window utilities', () => {
  const window = { tz: 'America/Chicago', start: '08:00', end: '19:00' };

  test('send at 07:59 delayed', () => {
    const now = fromZonedTime('2024-06-01T07:59:00', window.tz);
    expect(canSend(now, window)).toBe(false);
    const next = nextSendTime(now, window);
    expect(next.toISOString()).toBe(fromZonedTime('2024-06-01T08:00:00', window.tz).toISOString());
  });

  test('send at 08:00 allowed', () => {
    const now = fromZonedTime('2024-06-01T08:00:00', window.tz);
    expect(canSend(now, window)).toBe(true);
  });

  test('crossing midnight window', () => {
    const night = { tz: 'America/Chicago', start: '22:00', end: '06:00' };
    const before = fromZonedTime('2024-06-01T21:30:00', night.tz);
    expect(canSend(before, night)).toBe(false);
    const next = nextSendTime(before, night);
    expect(next.toISOString()).toBe(fromZonedTime('2024-06-01T22:00:00', night.tz).toISOString());
    const early = fromZonedTime('2024-06-01T07:00:00', night.tz);
    expect(canSend(early, night)).toBe(false);
    const nextEarly = nextSendTime(early, night);
    expect(nextEarly.toISOString()).toBe(fromZonedTime('2024-06-01T22:00:00', night.tz).toISOString());
  });

  test('dst transition fall back', () => {
    const dstNow = fromZonedTime('2024-11-03T07:59:00', window.tz);
    expect(canSend(dstNow, window)).toBe(false);
    const next = nextSendTime(dstNow, window);
    expect(next.toISOString()).toBe(fromZonedTime('2024-11-03T08:00:00', window.tz).toISOString());
  });
});
