import { Fragment, useEffect, useState } from 'react';
import styles from './people.module.css';
import { ReasonForm, RoleForm } from './ActionForm';
import InviteMemberPanel from '@/ui/components/InviteMemberPanel';
import { isDeactivated, memberActions, peopleRegister } from '@/lib/people-register';

interface Member {
  id: string;
  fullName: string;
  email: string;
  department?: string | null;
  roleName?: string | null;
  invitationPending?: boolean;
  accountStatus?: string | null;
}

interface PeopleProps {
  user: { id: string; permissions?: string[] } | null;
  organisation?: string;
  members: Member[];
  canInvite: boolean;
  onInvited: () => void;
  onResendInvitation: (memberId: string) => void;
  // Resolves null when the reset went through, else the reason it was refused.
  onResetTwoStep: (memberId: string, name: string, reason: string) => Promise<string | null>;
  // Resolves null when the member was deactivated, else the reason it was refused.
  onDeactivate: (memberId: string, name: string, reason: string) => Promise<string | null>;
  // Resolves null when the role was changed, else the reason it was refused.
  onChangeRole: (memberId: string, name: string, roleId: string, reason: string) => Promise<string | null>;
}

type OpenForm = 'RESET_TWO_STEP' | 'CHANGE_ROLE' | 'DEACTIVATE';

// The People tab: the organisation's members as a register, the invitation
// form for those who may invite, and what access in Veritas rests on.
export default function People({ user, organisation, members, canInvite, onInvited, onResendInvitation, onResetTwoStep, onDeactivate, onChangeRole }: PeopleProps) {
  const register = peopleRegister(members, user?.id);
  const pending = members.filter((m) => m.invitationPending && !isDeactivated(m)).length;
  // The member and form (two-step reset, role change or deactivation) currently open.
  const [open, setOpen] = useState<{ memberId: string; kind: OpenForm } | null>(null);
  const toggle = (memberId: string, kind: OpenForm) =>
    setOpen(open?.memberId === memberId && open.kind === kind ? null : { memberId, kind });
  // Roles offered when changing a member's role, loaded once for users.update.
  const canChangeRoles = Boolean(user?.permissions?.includes('users.update'));
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!canChangeRoles) return;
    fetch('/api/roles')
      .then((response) => (response.ok ? response.json() : { roles: [] }))
      .then((data) => setRoles(data.roles ?? []))
      .catch(() => setRoles([]));
  }, [canChangeRoles]);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h2 className={styles.headline}>People</h2>
        <p className={styles.lede}>
          {members.length} member{members.length === 1 ? '' : 's'}{organisation ? ` of ${organisation}` : ''}
          {pending > 0 ? `, ${pending} invitation${pending === 1 ? '' : 's'} pending` : ''}.
        </p>
      </header>

      <section aria-labelledby="members-title" className={styles.sheet}>
        <div className={styles.sheetHead}>
          <h3 id="members-title" className={styles.sheetKind}>Members</h3>
        </div>
        {register.length === 0 ? (
          <p className={styles.empty}>No members are listed.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.ledger}>
              <thead>
                <tr><th scope="col">Name</th><th scope="col">Work email</th><th scope="col">Role</th><th scope="col">Department</th><th scope="col">Sign-in</th><th scope="col"><span className={styles.visuallyHidden}>Actions</span></th></tr>
              </thead>
              <tbody>
                {register.map((member) => {
                  const actions = memberActions(member, user?.id, user?.permissions);
                  return (
                    <Fragment key={member.id}>
                    <tr>
                      <th scope="row" className={styles.name}>
                        {member.fullName}
                        {member.id === user?.id && <span className={styles.you}>you</span>}
                      </th>
                      <td className={styles.email}>{member.email}</td>
                      <td>{member.roleName || <span className={styles.muted}>No role</span>}</td>
                      <td>{member.department || <span className={styles.muted}>—</span>}</td>
                      <td>
                        {isDeactivated(member)
                          ? <span className={styles.muted}>Deactivated</span>
                          : member.invitationPending
                            ? <span className={styles.pending}>Invitation pending</span>
                            : <span>Active</span>}
                      </td>
                      <td className={styles.actions}>
                        {actions.includes('RESEND_INVITATION') && (
                          <button type="button" className={styles.textButton} onClick={() => onResendInvitation(member.id)}>Resend invitation</button>
                        )}
                        {actions.includes('RESET_TWO_STEP') && (
                          <button
                            type="button"
                            className={styles.textButton}
                            aria-expanded={open?.memberId === member.id && open.kind === 'RESET_TWO_STEP'}
                            onClick={() => toggle(member.id, 'RESET_TWO_STEP')}
                          >
                            Reset two-step verification
                          </button>
                        )}
                        {actions.includes('CHANGE_ROLE') && (
                          <button
                            type="button"
                            className={styles.textButton}
                            aria-expanded={open?.memberId === member.id && open.kind === 'CHANGE_ROLE'}
                            onClick={() => toggle(member.id, 'CHANGE_ROLE')}
                          >
                            Change role
                          </button>
                        )}
                        {actions.includes('DEACTIVATE') && (
                          <button
                            type="button"
                            className={styles.textButton}
                            aria-expanded={open?.memberId === member.id && open.kind === 'DEACTIVATE'}
                            onClick={() => toggle(member.id, 'DEACTIVATE')}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                    {open?.memberId === member.id && actions.includes(open.kind) && (
                      <tr className={styles.formRow}>
                        <td colSpan={6}>
                          {open.kind === 'CHANGE_ROLE' ? (
                            <RoleForm
                              roles={roles}
                              currentRoleName={member.roleName}
                              subject={member.fullName}
                              onSubmit={({ roleId, reason }) => onChangeRole(member.id, member.fullName, roleId, reason)}
                              onCancel={() => setOpen(null)}
                            />
                          ) : (
                            <ReasonForm
                              key={open.kind}
                              kind={open.kind}
                              subject={member.fullName}
                              onSubmit={({ reason }) => (open.kind === 'DEACTIVATE' ? onDeactivate : onResetTwoStep)(member.id, member.fullName, reason)}
                              onCancel={() => setOpen(null)}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canInvite && <InviteMemberPanel onInvited={onInvited} />}

      <section aria-labelledby="access-title" className={styles.notes}>
        <h3 id="access-title" className={styles.sectionTitle}>How access works</h3>
        <div className={styles.noteGrid}>
          <div>
            <h4 className={styles.noteTitle}>Roles and permissions</h4>
            <p>
              Each member&apos;s access comes from the permissions of their assigned role and is checked on every request; job titles grant nothing. An overview of which role holds which permission is not available yet.
            </p>
          </div>
          <div>
            <h4 className={styles.noteTitle}>Segregation of duties</h4>
            <p>
              Veritas stops an author from approving or releasing their own revision. Other separation rules are not enforced by the software; set them in your own procedures and confirm them when you validate.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
