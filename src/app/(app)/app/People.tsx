import styles from './people.module.css';
import InviteMemberPanel from '@/ui/components/InviteMemberPanel';
import { memberActions, peopleRegister } from '@/lib/people-register';

interface Member {
  id: string;
  fullName: string;
  email: string;
  department?: string | null;
  invitationPending?: boolean;
}

interface PeopleProps {
  user: { id: string; permissions?: string[] } | null;
  organisation?: string;
  members: Member[];
  canInvite: boolean;
  onInvited: () => void;
  onResendInvitation: (memberId: string) => void;
  onResetTwoStep: (memberId: string, name: string) => void;
}

// The People tab: the organisation's members as a register, the invitation
// form for those who may invite, and what access in Veritas rests on.
export default function People({ user, organisation, members, canInvite, onInvited, onResendInvitation, onResetTwoStep }: PeopleProps) {
  const register = peopleRegister(members, user?.id);
  const pending = members.filter((m) => m.invitationPending).length;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h2 className={styles.headline}>People</h2>
        <p className={styles.lede}>
          {members.length} member{members.length === 1 ? '' : 's'}{organisation ? ` of ${organisation}` : ''}
          {pending > 0 ? `, ${pending} invitation${pending === 1 ? '' : 's'} pending` : ''}.
          {' '}Changing a member&apos;s role and deactivating a member are not available yet.
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
                <tr><th scope="col">Name</th><th scope="col">Work email</th><th scope="col">Department</th><th scope="col">Sign-in</th><th scope="col"><span className={styles.visuallyHidden}>Actions</span></th></tr>
              </thead>
              <tbody>
                {register.map((member) => {
                  const actions = memberActions(member, user?.id, user?.permissions);
                  return (
                    <tr key={member.id}>
                      <th scope="row" className={styles.name}>
                        {member.fullName}
                        {member.id === user?.id && <span className={styles.you}>you</span>}
                      </th>
                      <td className={styles.email}>{member.email}</td>
                      <td>{member.department || <span className={styles.muted}>—</span>}</td>
                      <td>
                        {member.invitationPending
                          ? <span className={styles.pending}>Invitation pending</span>
                          : <span>Active</span>}
                      </td>
                      <td className={styles.actions}>
                        {actions.includes('RESEND_INVITATION') && (
                          <button type="button" className={styles.textButton} onClick={() => onResendInvitation(member.id)}>Resend invitation</button>
                        )}
                        {actions.includes('RESET_TWO_STEP') && (
                          <button type="button" className={styles.textButton} onClick={() => onResetTwoStep(member.id, member.fullName)}>Reset two-step verification</button>
                        )}
                      </td>
                    </tr>
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
