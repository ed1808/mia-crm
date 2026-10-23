import { describe, expect, it } from 'bun:test';
import { DomainError, FrozenClock, Result, SystemClock } from './index';

describe('Kernel building blocks', () => {
  it('Result.ok handles success values correctly', () => {
    const res = Result.ok(42);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe(42);
    }
  });

  it('Result.fail encapsulates typed DomainError', () => {
    const err = new DomainError('INVALID_INPUT', 'El valor suministrado no es válido');
    const res = Result.fail(err);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_INPUT');
      expect(res.error.message).toBe('El valor suministrado no es válido');
    }
  });

  it('Clock abstraction allows deterministic time testing', () => {
    const fixedIso = '2026-10-12T14:00:00.000Z';
    const clock = new FrozenClock(fixedIso);
    expect(clock.isoNow()).toBe(fixedIso);

    clock.advanceMs(1000 * 60); // +1 minuto
    expect(clock.isoNow()).toBe('2026-10-12T14:01:00.000Z');

    const liveClock = new SystemClock();
    expect(liveClock.now().getTime()).toBeGreaterThan(0);
  });
});
