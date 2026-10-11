import { describe, expect, it } from 'vitest';
import { memberActions, peopleRegister } from './people-register';

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

  it('PEOPLE-T004 lists the signed-in member first, then everyone by name', () => {
    const order = peopleRegister([
      { id: 'z', fullName: 'Zoe' }, { id: ME, fullName: 'Max' }, { id: 'b', fullName: 'Ben' },
    ], ME).map((m) => m.id);
    expect(order).toEqual([ME, 'b', 'z']);
  });
});
