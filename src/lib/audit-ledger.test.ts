import { describe, expect, it } from 'vitest';
import { groupByUtcDay, isExceptional, utcDay, utcTime } from './audit-ledger';

describe('audit ledger', () => {
  it('AUDITLEDGER-T001 groups entries by UTC day in the order given', () => {
    const groups = groupByUtcDay([
      { id: 'c', timestamp: '2026-10-10T23:30:00.000Z' },
      { id: 'b', timestamp: '2026-10-10T00:10:00.000Z' },
      { id: 'a', timestamp: '2026-10-09T23:59:59.000Z' },
    ]);
    expect(groups.map((g) => [g.day, g.entries.map((e) => e.id)])).toEqual([
      ['2026-10-10', ['c', 'b']],
      ['2026-10-09', ['a']],
    ]);
  });

  it('AUDITLEDGER-T002 reads day and time in UTC whatever the offset in the timestamp', () => {
    expect(utcDay('2026-10-11T01:30:00+02:00')).toBe('2026-10-10');
    expect(utcTime('2026-10-11T01:30:05+02:00')).toBe('23:30:05');
  });

  it('AUDITLEDGER-T003 marks every outcome other than Success', () => {
    expect(isExceptional('Success')).toBe(false);
    expect(isExceptional('Denied')).toBe(true);
    expect(isExceptional('Failure')).toBe(true);
  });

  it('AUDITLEDGER-T004 returns no groups for no entries', () => {
    expect(groupByUtcDay([])).toEqual([]);
  });
});
