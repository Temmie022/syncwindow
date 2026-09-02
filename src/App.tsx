import { FormEvent, useId, useMemo, useState } from 'react';
import {
  COMMON_ZONES,
  DEFAULT_MEMBERS,
  computeOverlap,
  formatDuration,
  formatHm,
  formatOverlapRange,
  isValidTimeZone,
  listSupportedTimeZones,
  parseHm,
  windowToBarPercent,
  type TeamMember,
} from './overlap';
import './App.css';

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextId(): string {
  return `m-${Math.random().toString(36).slice(2, 9)}`;
}

function zoneLabel(timeZone: string): string {
  const known = COMMON_ZONES.find((z) => z.timeZone === timeZone);
  if (known) return known.label;
  const city = timeZone.split('/').pop() ?? timeZone;
  return city.replaceAll('_', ' ');
}

export default function App() {
  const dateId = useId();
  const addLabelId = useId();
  const addZoneId = useId();
  const addStartId = useId();
  const addEndId = useId();

  const [dateIso, setDateIso] = useState(todayIso);
  const [members, setMembers] = useState<TeamMember[]>(DEFAULT_MEMBERS);
  const [addLabel, setAddLabel] = useState('');
  const [addZone, setAddZone] = useState('');
  const [addStart, setAddStart] = useState('09:00');
  const [addEnd, setAddEnd] = useState('17:00');
  const [addError, setAddError] = useState<string | null>(null);

  const zones = useMemo(() => listSupportedTimeZones(), []);
  const result = useMemo(() => computeOverlap(dateIso, members), [dateIso, members]);

  function updateMember(id: string, patch: Partial<TeamMember>) {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, ...patch } : member)),
    );
  }

  function removeMember(id: string) {
    setMembers((current) => current.filter((member) => member.id !== id));
  }

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const startMinutes = parseHm(addStart);
    const endMinutes = parseHm(addEnd);
    const timeZone = addZone.trim();
    const label = addLabel.trim() || zoneLabel(timeZone);

    if (!isValidTimeZone(timeZone)) {
      setAddError('Use a valid IANA time zone, for example America/Chicago or Europe/Paris.');
      return;
    }
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      setAddError('Work hours must be a same-day window, like 09:00 to 17:00.');
      return;
    }

    setMembers((current) => [
      ...current,
      { id: nextId(), label, timeZone, startMinutes, endMinutes },
    ]);
    setAddLabel('');
    setAddZone('');
    setAddStart('09:00');
    setAddEnd('17:00');
    setAddError(null);
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Remote meeting planner</p>
        <h1>syncwindow</h1>
        <p className="lede">
          Find the hours when a distributed US and EU team is online at the
          same time. Set each city&apos;s local work day, then read the shared
          window in every zone.
        </p>
      </header>

      <main>
        <section className="panel" aria-labelledby="team-heading">
          <div className="panel-head">
            <h2 id="team-heading">Team</h2>
            <div className="date-field">
              <label htmlFor={dateId}>Date</label>
              <input
                id={dateId}
                type="date"
                value={dateIso}
                onChange={(event) => setDateIso(event.target.value)}
              />
            </div>
          </div>
          <p className="hint">
            Defaults: New York, San Francisco, London, and Berlin, each 09:00–17:00
            local. Change hours or add any IANA zone. Date matters because US and
            EU daylight saving rules differ.
          </p>

          <ul className="member-list">
            {members.map((member) => (
              <li key={member.id} className="member-card">
                <div className="member-title">
                  <strong>{member.label}</strong>
                  <span className="zone">{member.timeZone}</span>
                </div>
                <div className="hours">
                  <label>
                    Start
                    <input
                      type="time"
                      value={formatHm(member.startMinutes)}
                      onChange={(event) => {
                        const parsed = parseHm(event.target.value);
                        if (parsed !== null) updateMember(member.id, { startMinutes: parsed });
                      }}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="time"
                      value={formatHm(member.endMinutes)}
                      onChange={(event) => {
                        const parsed = parseHm(event.target.value);
                        if (parsed !== null) updateMember(member.id, { endMinutes: parsed });
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => removeMember(member.id)}
                  >
                    Remove {member.label}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form className="add-form" onSubmit={onAdd} aria-labelledby="add-heading">
            <h3 id="add-heading">Add a city or zone</h3>
            <div className="add-grid">
              <label htmlFor={addLabelId}>
                Label
                <input
                  id={addLabelId}
                  value={addLabel}
                  onChange={(event) => setAddLabel(event.target.value)}
                  placeholder="Chicago"
                  autoComplete="off"
                />
              </label>
              <label htmlFor={addZoneId}>
                IANA time zone
                <input
                  id={addZoneId}
                  list="zone-options"
                  value={addZone}
                  onChange={(event) => setAddZone(event.target.value)}
                  placeholder="America/Chicago"
                  required
                  autoComplete="off"
                />
                <datalist id="zone-options">
                  {COMMON_ZONES.map((zone) => (
                    <option key={`${zone.label}-${zone.timeZone}`} value={zone.timeZone}>
                      {zone.label}
                    </option>
                  ))}
                  {zones.slice(0, 80).map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              </label>
              <label htmlFor={addStartId}>
                Start
                <input
                  id={addStartId}
                  type="time"
                  value={addStart}
                  onChange={(event) => setAddStart(event.target.value)}
                  required
                />
              </label>
              <label htmlFor={addEndId}>
                End
                <input
                  id={addEndId}
                  type="time"
                  value={addEnd}
                  onChange={(event) => setAddEnd(event.target.value)}
                  required
                />
              </label>
            </div>
            {addError ? (
              <p className="error" role="alert">
                {addError}
              </p>
            ) : null}
            <button type="submit">Add to team</button>
          </form>
        </section>

        <section className="panel result" aria-labelledby="result-heading">
          <h2 id="result-heading">Shared window</h2>
          <div aria-live="polite" className="live">
            {members.length === 0 ? (
              <p>Add at least one city to calculate overlap.</p>
            ) : result.hasOverlap && result.start && result.end ? (
              <>
                <p className="duration">
                  <span className="badge">Overlap</span>
                  {formatDuration(result.durationMinutes)} together
                </p>
                <p className="utc-line">
                  UTC {formatOverlapRange(result.start, result.end, 'UTC')}
                </p>
                <ul className="local-times">
                  {members.map((member) => (
                    <li key={member.id}>
                      <span className="city">{member.label}</span>
                      <span className="range">
                        {formatOverlapRange(result.start!, result.end!, member.timeZone)}
                      </span>
                      <span className="zone">{member.timeZone}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                No shared hours on this date. Widen local work days, drop a
                city, or pick another date — US and EU 09:00–17:00 days often
                miss each other, especially with San Francisco in the mix.
              </p>
            )}
          </div>

          {result.memberWindows.length > 0 ? (
            <Timeline
              dateIso={dateIso}
              memberWindows={result.memberWindows}
              overlapStart={result.start}
              overlapEnd={result.end}
            />
          ) : null}
        </section>
      </main>

      <footer>
        <p>
          Junior portfolio project by Israel Temmie. Client-only app — no
          accounts, no backend, no tracking. MIT licensed.
        </p>
      </footer>
    </div>
  );
}

interface TimelineProps {
  dateIso: string;
  memberWindows: ReturnType<typeof computeOverlap>['memberWindows'];
  overlapStart: Date | null;
  overlapEnd: Date | null;
}

function Timeline({ dateIso, memberWindows, overlapStart, overlapEnd }: TimelineProps) {
  const overlapBar =
    overlapStart && overlapEnd ? windowToBarPercent(overlapStart, overlapEnd, dateIso) : null;

  return (
    <div className="timeline" aria-label="UTC day timeline of local work hours">
      <p className="timeline-caption">UTC day, 00:00–24:00. Bars are each city&apos;s local work hours.</p>
      {memberWindows.map(({ member, start, end }) => {
        const bar = windowToBarPercent(start, end, dateIso);
        if (!bar) return null;
        return (
          <div key={member.id} className="track">
            <div className="track-label">{member.label}</div>
            <div className="track-bar" role="img" aria-label={`${member.label} works ${formatHm(member.startMinutes)} to ${formatHm(member.endMinutes)} local`}>
              <span className="work" style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
              {overlapBar ? (
                <span
                  className="shared"
                  style={{ left: `${overlapBar.left}%`, width: `${overlapBar.width}%` }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="ticks" aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
