// The Audit trail tab shows entries as a ledger grouped by day. Days and
// times are in UTC, labelled as such, so every reader sees the same day for
// the same entry whatever their browser's time zone.

export interface LedgerEntry {
  timestamp: string;
}

export function utcDay(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function utcTime(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(11, 19);
}

// Keeps the order the route returned (newest first) and starts a new group
// whenever the UTC day changes.
export function groupByUtcDay<T extends LedgerEntry>(entries: readonly T[]): Array<{ day: string; entries: T[] }> {
  const groups: Array<{ day: string; entries: T[] }> = [];
  for (const entry of entries) {
    const day = utcDay(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

// A non-success outcome is shown prominently; successful entries are the norm.
export function isExceptional(status: string): boolean {
  return status !== 'Success';
}
