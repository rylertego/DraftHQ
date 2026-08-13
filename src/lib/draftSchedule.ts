// Converting between a wall-clock draft time ("Sept 1, 7:00 PM Eastern") and
// the UTC instant stored in drafts.scheduled_at.
//
// Both directions were previously wrong. The write did
// `new Date(`${date}T${time}`).toISOString()`, which interprets the input in
// the *browser's* zone while a separate timezone dropdown was stored alongside
// it and never applied — a commissioner in Chicago scheduling for Eastern got a
// time an hour off. The read did `.toISOString().slice(11,16)`, which is UTC, so
// saving 7:00 PM and reloading the page displayed 23:00.
//
// No date library in this project, so the offset is derived from Intl.

/** Milliseconds to add to a UTC instant to get the wall-clock reading in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Some environments render midnight as hour 24.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - instant.getTime();
}

/**
 * A wall-clock date/time in `timeZone` → the ISO instant to persist.
 *
 * `date` is `YYYY-MM-DD` and `time` is `HH:mm`, matching the date/time inputs.
 * An empty time is treated as midnight.
 */
export function zonedWallClockToUtc(date: string, time: string, timeZone: string): string {
  const naive = Date.parse(`${date}T${time || "00:00"}:00Z`);
  if (Number.isNaN(naive)) {
    throw new Error(`Invalid draft date/time: ${date} ${time}`);
  }

  // The first pass reads the offset at the naive instant. Near a DST boundary
  // that guess can sit on the wrong side of the transition, so re-read it at
  // the corrected instant — which is where the event actually falls.
  const firstGuess = zoneOffsetMs(new Date(naive), timeZone);
  const corrected = zoneOffsetMs(new Date(naive - firstGuess), timeZone);
  return new Date(naive - corrected).toISOString();
}

/**
 * The stored ISO instant → the wall-clock date/time to show in `timeZone`.
 * Inverse of {@link zonedWallClockToUtc}.
 */
export function utcToZonedWallClock(
  iso: string,
  timeZone: string
): { date: string; time: string } {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid stored draft time: ${iso}`);
  }

  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, timeZone));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

/** The viewer's own zone, for defaulting the picker. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
