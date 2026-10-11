import { describe, expect, it } from 'vitest';
import { isDeactivated, memberActions, peopleRegister } from './people-register';

const ME = 'me';
const active = { id: 'a', fullName: 'Ana', invitationPending: false };
const pending = { id: 'p', fullName: 'Pia', invitationPending: true };

describe('People tab', () => {
  it('PEOPLE-T001 offers resending a pending invitation only with users.create', () => {
    expect(memberActions(pending, ME, ['users.create'])).toEqual(['RESEND_INVITATION']);
    expect(memberActions(pending, ME, ['users.update', 'users.read'])).toEqual([]);
  });

  it('PEOPLE-T002 offers resetting two-step verification of another active member only with users.update', () => {
    expect(memberActions(active, ME, ['users.update'])).toEqual(['RESET_TWO_STEP']);
    expect(memberActions(active, ME, ['users.create'])).toEqual([]);
    expect(memberActions({ ...active, id: ME }, ME, ['users.update'])).toEqual([]);
    expect(memberActions(active, undefined, ['users.update'])).toEqual([]);
  });

  it('PEOPLE-T003 never offers a reset on a pending invitation', () => {
    expect(memberActions(pending, ME, ['users.update'])).toEqual([]);
  });

  it('PEOPLE-T005 offers deactivating another member, active or invited, only with users.deactivate', () => {
    expect(memberActions(active, ME, ['users.deactivate'])).toEqual(['DEACTIVATE']);
    expect(memberActions(active, ME, ['users.update', 'users.deactivate'])).toEqual(['RESET_TWO_STEP', 'DEACTIVATE']);
    expect(memberActions(pending, ME, ['users.create', 'users.deactivate'])).toEqual(['RESEND_INVITATION', 'DEACTIVATE']);
    expect(memberActions(active, ME, ['users.update'])).not.toContain('DEACTIVATE');
    expect(memberActions({ ...active, id: ME }, ME, ['users.deactivate'])).toEqual([]);
    expect(memberActions(active, undefined, ['users.deactivate'])).toEqual([]);
  });

  it('PEOPLE-T006 offers nothing on a deactivated member', () => {
    const gone = { ...active, accountStatus: 'INACTIVE' };
    expect(isDeactivated(gone)).toBe(true);
    expect(isDeactivated(active)).toBe(false);
    expect(memberActions(gone, ME, ['users.create', 'users.update', 'users.deactivate'])).toEqual([]);
    expect(memberActions({ ...pending, accountStatus: 'INACTIVE' }, ME, ['users.create', 'users.deactivate'])).toEqual([]);
  });

  it('PEOPLE-T004 lists the signed-in member first, then everyone by name', () => {
    const order = peopleRegister([
      { id: 'z', fullName: 'Zoe' }, { id: ME, fullName: 'Max' }, { id: 'b', fullName: 'Ben' },
    ], ME).map((m) => m.id);
    expect(order).toEqual([ME, 'b', 'z']);
  });
});
