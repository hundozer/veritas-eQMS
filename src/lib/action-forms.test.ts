import { describe, expect, it } from 'vitest';
import { checkReason, checkRoleChange, checkRouting, REASON_FORMS, routingCandidates } from './action-forms';

const members = [
  { id: 'u3', fullName: 'Zoe Approver', email: 'zoe@example.test', accountStatus: 'ACTIVE' },
  { id: 'u1', fullName: 'Ada Reviewer', email: 'ada@example.test', accountStatus: 'ACTIVE' },
  { id: 'u2', fullName: 'Ben Invited', email: 'ben@example.test', accountStatus: 'ACTIVE', invitationPending: true },
  { id: 'u4', fullName: 'Cy Inactive', email: 'cy@example.test', accountStatus: 'INACTIVE' },
];

describe('action forms', () => {
  it('ACTION-FORM-T001 routes only to active members who finished signing up, in name order', () => {
    expect(routingCandidates(members).map((m) => m.id)).toEqual(['u1', 'u3']);
  });

  it('ACTION-FORM-T002 needs a distinct reviewer and approver from the candidates', () => {
    const candidates = routingCandidates(members);
    expect(checkRouting('', 'u3', candidates)).toEqual({ ok: false, message: 'Choose a reviewer and an approver.' });
    expect(checkRouting('u1', 'u1', candidates)).toEqual({ ok: false, message: 'The reviewer and the approver must be different people.' });
    expect(checkRouting('u1', 'u2', candidates)).toEqual({ ok: false, message: 'Choose the reviewer and approver from the list.' });
    expect(checkRouting('u1', 'u3', candidates)).toEqual({ ok: true, value: { reviewerId: 'u1', approverId: 'u3' } });
  });

  it('ACTION-FORM-T003 a reason is required and trimmed', () => {
    expect(checkReason('RETURN', '   ')).toEqual({ ok: false, message: 'Enter the reason for returning.' });
    expect(checkReason('WITHDRAW_REVISION', '  superseded by CC-12 ')).toEqual({ ok: true, value: { reason: 'superseded by CC-12', file: null } });
    expect(checkReason('RESET_TWO_STEP', 'lost phone')).toMatchObject({ ok: true });
  });

  it('ACTION-FORM-T004 a new revision also needs its source file', () => {
    expect(REASON_FORMS.START_REVISION.needsFile).toBe(true);
    expect(checkReason('START_REVISION', 'annual review')).toEqual({ ok: false, message: 'Choose the source file for the new revision.' });
    const file = new File(['x'], 'sop.pdf', { type: 'application/pdf' });
    expect(checkReason('START_REVISION', 'annual review', file)).toEqual({ ok: true, value: { reason: 'annual review', file } });
  });

  it('ACTION-FORM-T009 a role change needs a listed role other than the current one, and a reason', () => {
    const roles = [{ id: 'r1', name: 'Quality Manager' }, { id: 'r2', name: 'Employee' }];
    expect(checkRoleChange('', 'moved', 'Employee', roles)).toEqual({ ok: false, message: 'Choose the new role from the list.' });
    expect(checkRoleChange('r9', 'moved', 'Employee', roles)).toEqual({ ok: false, message: 'Choose the new role from the list.' });
    expect(checkRoleChange('r2', 'moved', 'Employee', roles)).toEqual({ ok: false, message: 'The member already has this role.' });
    expect(checkRoleChange('r1', '  ', 'Employee', roles)).toEqual({ ok: false, message: 'Enter the reason for the change.' });
    expect(checkRoleChange('r1', ' promoted ', 'Employee', roles)).toEqual({ ok: true, value: { roleId: 'r1', reason: 'promoted' } });
  });
});
