/**
 * Overlap math for syncwindow.
 * Converts local work windows in IANA time zones to UTC, then
 * finds the shared interval across a distributed team.
 */

export interface TeamMember {
  id: string;
  label: string;
  timeZone: string;
  /** Minutes from local midnight, inclusive. 9:00 = 540 */
  startMinutes: number;
  /** Minutes from local midnight, exclusive. 17:00 = 1020 */
  endMinutes: number;
}

export interface UtcWindow {
  start: Date;
  end: Date;
}

export interface MemberWindow extends UtcWindow {
  member: TeamMember;
}

export interface OverlapResult {
  hasOverlap: boolean;
  start: Date | null;
  end: Date | null;
  durationMinutes: number;
  memberWindows: MemberWindow[];
}

export const DEFAULT_MEMBERS: TeamMember[] = [
  {
    id: 'ny',
    label: 'New York',
    timeZone: 'America/New_York',
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  },
  {
    id: 'sf',
    label: 'San Francisco',
    timeZone: 'America/Los_Angeles',
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  },
  {
    id: 'ldn',
    label: 'London',
    timeZone: 'Europe/London',
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  },
  {
    id: 'ber',
    label: 'Berlin',
    timeZone: 'Europe/Berlin',
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  },
];

export const COMMON_ZONES: { label: string; timeZone: string }[] = [
  { label: 'New York', timeZone: 'America/New_York' },
  { label: 'Boston', timeZone: 'America/New_York' },
  { label: 'Chicago', timeZone: 'America/Chicago' },
  { label: 'Denver', timeZone: 'America/Denver' },
  { label: 'San Francisco', timeZone: 'America/Los_Angeles' },
  { label: 'Seattle', timeZone: 'America/Los_Angeles' },
  { label: 'Los Angeles', timeZone: 'America/Los_Angeles' },
  { label: 'Toronto', timeZone: 'America/Toronto' },
  { label: 'London', timeZone: 'Europe/London' },
  { label: 'Dublin', timeZone: 'Europe/Dublin' },
  { label: 'Lisbon', timeZone: 'Europe/Lisbon' },
  { label: 'Paris', timeZone: 'Europe/Paris' },
  { label: 'Berlin', timeZone: 'Europe/Berlin' },
  { label: 'Amsterdam', timeZone: 'Europe/Amsterdam' },
  { label: 'Madrid', timeZone: 'Europe/Madrid' },
  { label: 'Rome', timeZone: 'Europe/Rome' },
  { label: 'Stockholm', timeZone: 'Europe/Stockholm' },
  { label: 'Warsaw', timeZone: 'Europe/Warsaw' },
  { label: 'Athens', timeZone: 'Europe/Athens' },
  { label: 'UTC', timeZone: 'UTC' },
];

const MINUTES_PER_DAY = 24 * 60;

export function parseHm(value: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatHm(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function isValidWorkWindow(startMinutes: number, endMinutes: number): boolean {
  return (
    Number.isInteger(startMinutes) &&
    Number.isInteger(endMinutes) &&
    startMinutes >= 0 &&
    endMinutes <= MINUTES_PER_DAY &&
    startMinutes < endMinutes
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function readWallClock(date: Date, timeZone: string): WallParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find((part) => part.type === type)?.value ?? '0';
    return Number(raw);
  };
  let hour = read('hour');
  if (hour === 24) hour = 0;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Uses Intl so daylight saving is handled by the engine.
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guess = new Date(wanted);
  const shown = readWallClock(guess, timeZone);
  const shownAsUtc = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  );
  let resultMs = wanted - (shownAsUtc - wanted);

  const shown2 = readWallClock(new Date(resultMs), timeZone);
  const shown2AsUtc = Date.UTC(
    shown2.year,
    shown2.month - 1,
    shown2.day,
    shown2.hour,
    shown2.minute,
    shown2.second,
  );
  resultMs += wanted - shown2AsUtc;
  return new Date(resultMs);
}

export function localWindowToUtc(
  year: number,
  month: number,
  day: number,
  member: TeamMember,
): UtcWindow | null {
  if (!isValidWorkWindow(member.startMinutes, member.endMinutes)) return null;
  if (!isValidTimeZone(member.timeZone)) return null;

  const startHour = Math.floor(member.startMinutes / 60);
  const startMin = member.startMinutes % 60;
  const endHour = Math.floor(member.endMinutes / 60);
  const endMin = member.endMinutes % 60;

  const start = zonedLocalToUtc(year, month, day, startHour, startMin, member.timeZone);
  let end: Date;
  if (member.endMinutes === MINUTES_PER_DAY) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    end = zonedLocalToUtc(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      0,
      0,
      member.timeZone,
    );
  } else {
    end = zonedLocalToUtc(year, month, day, endHour, endMin, member.timeZone);
  }

  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

export function intersectUtcWindows(windows: UtcWindow[]): UtcWindow | null {
  if (windows.length === 0) return null;
  let startMs = windows[0].start.getTime();
  let endMs = windows[0].end.getTime();
  for (let i = 1; i < windows.length; i += 1) {
    startMs = Math.max(startMs, windows[i].start.getTime());
    endMs = Math.min(endMs, windows[i].end.getTime());
  }
  if (startMs >= endMs) return null;
  return { start: new Date(startMs), end: new Date(endMs) };
}

export function computeOverlap(
  dateIso: string,
  members: TeamMember[],
): OverlapResult {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!match || members.length === 0) {
    return {
      hasOverlap: false,
      start: null,
      end: null,
      durationMinutes: 0,
      memberWindows: [],
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const memberWindows: MemberWindow[] = [];
  for (const member of members) {
    const window = localWindowToUtc(year, month, day, member);
    if (!window) {
      return {
        hasOverlap: false,
        start: null,
        end: null,
        durationMinutes: 0,
        memberWindows: [],
      };
    }
    memberWindows.push({ member, ...window });
  }

  const shared = intersectUtcWindows(memberWindows);
  if (!shared) {
    return {
      hasOverlap: false,
      start: null,
      end: null,
      durationMinutes: 0,
      memberWindows,
    };
  }

  const durationMinutes = Math.round(
    (shared.end.getTime() - shared.start.getTime()) / 60_000,
  );

  return {
    hasOverlap: true,
    start: shared.start,
    end: shared.end,
    durationMinutes,
    memberWindows,
  };
}

export function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatOverlapRange(start: Date, end: Date, timeZone: string): string {
  return `${formatInZone(start, timeZone)}–${formatInZone(end, timeZone)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours} h ${mins} min`;
}

export function utcMinutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function listSupportedTimeZones(): string[] {
  const intlWithZones = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof intlWithZones.supportedValuesOf === 'function') {
    return intlWithZones.supportedValuesOf('timeZone');
  }
  return COMMON_ZONES.map((zone) => zone.timeZone);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function utcDayOrigin(dateIso: string): number | null {
  const origin = Date.parse(`${dateIso}T00:00:00.000Z`);
  return Number.isNaN(origin) ? null : origin;
}

/** Position a UTC interval on a 00:00–24:00 UTC bar for `dateIso`. */
export function windowToBarPercent(
  start: Date,
  end: Date,
  dateIso: string,
): { left: number; width: number } | null {
  const origin = utcDayOrigin(dateIso);
  if (origin === null) return null;
  const leftMs = Math.max(0, start.getTime() - origin);
  const rightMs = Math.min(MS_PER_DAY, end.getTime() - origin);
  if (rightMs <= leftMs) return null;
  return {
    left: (leftMs / MS_PER_DAY) * 100,
    width: ((rightMs - leftMs) / MS_PER_DAY) * 100,
  };
}
