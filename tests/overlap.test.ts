import { describe, expect, it } from 'vitest';
import {
  COMMON_ZONES,
  DEFAULT_MEMBERS,
  computeOverlap,
  formatDuration,
  formatHm,
  formatOverlapRange,
  intersectUtcWindows,
  isValidTimeZone,
  isValidWorkWindow,
  localWindowToUtc,
  parseHm,
  utcMinutesOfDay,
  windowToBarPercent,
  zonedLocalToUtc,
  type TeamMember,
} from '../src/overlap';

const NY: TeamMember = {
  id: 'ny',
  label: 'New York',
  timeZone: 'America/New_York',
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

const SF: TeamMember = {
  id: 'sf',
  label: 'San Francisco',
  timeZone: 'America/Los_Angeles',
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

const LDN: TeamMember = {
  id: 'ldn',
  label: 'London',
  timeZone: 'Europe/London',
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

describe('parseHm / formatHm', () => {
  it('parses 24-hour clock strings', () => {
    expect(parseHm('09:00')).toBe(540);
    expect(parseHm('17:30')).toBe(17 * 60 + 30);
    expect(parseHm('00:00')).toBe(0);
    expect(parseHm('23:59')).toBe(23 * 60 + 59);
  });

  it('rejects invalid clock strings', () => {
    expect(parseHm('9:00')).toBe(540);
    expect(parseHm('24:00')).toBeNull();
    expect(parseHm('12:60')).toBeNull();
    expect(parseHm('abc')).toBeNull();
    expect(parseHm('')).toBeNull();
  });

  it('formats minutes back to HH:MM', () => {
    expect(formatHm(540)).toBe('09:00');
    expect(formatHm(0)).toBe('00:00');
    expect(formatHm(23 * 60 + 59)).toBe('23:59');
  });
});

describe('work window validation', () => {
  it('requires start before end on the same local day', () => {
    expect(isValidWorkWindow(9 * 60, 17 * 60)).toBe(true);
    expect(isValidWorkWindow(8 * 60, 18 * 60)).toBe(true);
    expect(isValidWorkWindow(9 * 60, 9 * 60)).toBe(false);
    expect(isValidWorkWindow(17 * 60, 9 * 60)).toBe(false);
    expect(isValidWorkWindow(-1, 17 * 60)).toBe(false);
  });
});

describe('time zone validation', () => {
  it('accepts IANA identifiers used in the app', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects unknown identifiers', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('zonedLocalToUtc (winter 2026-01-14)', () => {
  const y = 2026;
  const m = 1;
  const d = 14;

  it('maps New York 09:00 EST to 14:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-01-14T14:00:00.000Z');
  });

  it('maps San Francisco 09:00 PST to 17:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'America/Los_Angeles');
    expect(utc.toISOString()).toBe('2026-01-14T17:00:00.000Z');
  });

  it('maps London 09:00 GMT to 09:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'Europe/London');
    expect(utc.toISOString()).toBe('2026-01-14T09:00:00.000Z');
  });

  it('maps Berlin 09:00 CET to 08:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'Europe/Berlin');
    expect(utc.toISOString()).toBe('2026-01-14T08:00:00.000Z');
  });
});

describe('zonedLocalToUtc (summer 2026-07-15)', () => {
  const y = 2026;
  const m = 7;
  const d = 15;

  it('maps New York 09:00 EDT to 13:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('maps London 09:00 BST to 08:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'Europe/London');
    expect(utc.toISOString()).toBe('2026-07-15T08:00:00.000Z');
  });

  it('maps Berlin 09:00 CEST to 07:00 UTC', () => {
    const utc = zonedLocalToUtc(y, m, d, 9, 0, 'Europe/Berlin');
    expect(utc.toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });
});

describe('computeOverlap: New York + San Francisco', () => {
  it('winter 9-17: five shared hours (12:00-17:00 NY / 09:00-14:00 SF)', () => {
    const result = computeOverlap('2026-01-14', [NY, SF]);
    expect(result.hasOverlap).toBe(true);
    expect(result.durationMinutes).toBe(5 * 60);
    expect(result.start?.toISOString()).toBe('2026-01-14T17:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2026-01-14T22:00:00.000Z');
    expect(formatOverlapRange(result.start!, result.end!, 'America/New_York')).toBe(
      '12:00–17:00',
    );
    expect(formatOverlapRange(result.start!, result.end!, 'America/Los_Angeles')).toBe(
      '09:00–14:00',
    );
  });
});

describe('computeOverlap: New York + London', () => {
  it('winter 9-17: three shared hours (09:00-12:00 NY / 14:00-17:00 London)', () => {
    const result = computeOverlap('2026-01-14', [NY, LDN]);
    expect(result.hasOverlap).toBe(true);
    expect(result.durationMinutes).toBe(3 * 60);
    expect(result.start?.toISOString()).toBe('2026-01-14T14:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2026-01-14T17:00:00.000Z');
    expect(formatOverlapRange(result.start!, result.end!, 'America/New_York')).toBe(
      '09:00–12:00',
    );
    expect(formatOverlapRange(result.start!, result.end!, 'Europe/London')).toBe(
      '14:00–17:00',
    );
  });

  it('summer 9-17: three shared hours', () => {
    const result = computeOverlap('2026-07-15', [NY, LDN]);
    expect(result.hasOverlap).toBe(true);
    expect(result.durationMinutes).toBe(3 * 60);
    expect(result.start?.toISOString()).toBe('2026-07-15T13:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });
});

describe('computeOverlap: default four-city team', () => {
  it('has no shared 9-17 window in winter', () => {
    const result = computeOverlap('2026-01-14', DEFAULT_MEMBERS);
    expect(result.hasOverlap).toBe(false);
    expect(result.durationMinutes).toBe(0);
    expect(result.memberWindows).toHaveLength(4);
  });

  it('has no shared 9-17 window in summer', () => {
    const result = computeOverlap('2026-07-15', DEFAULT_MEMBERS);
    expect(result.hasOverlap).toBe(false);
  });

  it('finds a one-hour window when everyone works 08:00-18:00 in winter', () => {
    const stretched = DEFAULT_MEMBERS.map((member) => ({
      ...member,
      startMinutes: 8 * 60,
      endMinutes: 18 * 60,
    }));
    const result = computeOverlap('2026-01-14', stretched);
    expect(result.hasOverlap).toBe(true);
    expect(result.durationMinutes).toBe(60);
    expect(result.start?.toISOString()).toBe('2026-01-14T16:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2026-01-14T17:00:00.000Z');
  });
});

describe('computeOverlap: custom hours and edge cases', () => {
  it('returns the full local window for a single member', () => {
    const result = computeOverlap('2026-01-14', [NY]);
    expect(result.hasOverlap).toBe(true);
    expect(result.durationMinutes).toBe(8 * 60);
    expect(result.start?.toISOString()).toBe('2026-01-14T14:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('returns no overlap for an empty team', () => {
    const result = computeOverlap('2026-01-14', []);
    expect(result.hasOverlap).toBe(false);
    expect(result.durationMinutes).toBe(0);
  });

  it('returns no overlap for an invalid date string', () => {
    const result = computeOverlap('14/01/2026', [NY, LDN]);
    expect(result.hasOverlap).toBe(false);
  });

  it('returns no overlap when hours do not intersect', () => {
    const earlyLondon: TeamMember = { ...LDN, startMinutes: 9 * 60, endMinutes: 12 * 60 };
    const lateNy: TeamMember = { ...NY, startMinutes: 13 * 60, endMinutes: 17 * 60 };
    const result = computeOverlap('2026-01-14', [earlyLondon, lateNy]);
    expect(result.hasOverlap).toBe(false);
  });

  it('respects shorter US hours against a standard EU day', () => {
    const morningNy: TeamMember = { ...NY, startMinutes: 9 * 60, endMinutes: 12 * 60 };
    const result = computeOverlap('2026-01-14', [morningNy, LDN]);
    expect(result.hasOverlap).toBe(true);
    expect(result.durationMinutes).toBe(3 * 60);
  });

  it('rejects a member with inverted hours', () => {
    const bad: TeamMember = { ...NY, startMinutes: 17 * 60, endMinutes: 9 * 60 };
    const window = localWindowToUtc(2026, 1, 14, bad);
    expect(window).toBeNull();
    const result = computeOverlap('2026-01-14', [bad, LDN]);
    expect(result.hasOverlap).toBe(false);
  });
});

describe('intersectUtcWindows', () => {
  it('returns null when two UTC ranges miss each other', () => {
    const a = {
      start: new Date('2026-01-14T08:00:00.000Z'),
      end: new Date('2026-01-14T10:00:00.000Z'),
    };
    const b = {
      start: new Date('2026-01-14T10:00:00.000Z'),
      end: new Date('2026-01-14T12:00:00.000Z'),
    };
    expect(intersectUtcWindows([a, b])).toBeNull();
  });
});

describe('helpers', () => {
  it('formats durations in plain English', () => {
    expect(formatDuration(60)).toBe('1 hour');
    expect(formatDuration(180)).toBe('3 hours');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('reads UTC minutes of day', () => {
    expect(utcMinutesOfDay(new Date('2026-01-14T16:30:00.000Z'))).toBe(16 * 60 + 30);
  });

  it('ships the four default US/EU cities', () => {
    expect(DEFAULT_MEMBERS.map((m) => m.timeZone)).toEqual([
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Berlin',
    ]);
    expect(COMMON_ZONES.some((z) => z.timeZone === 'Europe/Berlin')).toBe(true);
  });
});

describe('windowToBarPercent', () => {
  it('places a winter New York 9-17 day on the UTC bar', () => {
    const start = new Date('2026-01-14T14:00:00.000Z');
    const end = new Date('2026-01-14T22:00:00.000Z');
    const bar = windowToBarPercent(start, end, '2026-01-14');
    expect(bar).not.toBeNull();
    expect(bar!.left).toBeCloseTo((14 / 24) * 100);
    expect(bar!.width).toBeCloseTo((8 / 24) * 100);
  });

  it('clips a San Francisco window that crosses UTC midnight', () => {
    const start = new Date('2026-01-14T17:00:00.000Z');
    const end = new Date('2026-01-15T01:00:00.000Z');
    const bar = windowToBarPercent(start, end, '2026-01-14');
    expect(bar).not.toBeNull();
    expect(bar!.left).toBeCloseTo((17 / 24) * 100);
    expect(bar!.width).toBeCloseTo((7 / 24) * 100);
  });
});
