// Which workspace sections a member is offered, from the persisted permissions
// returned with the session; never from a job title or role name (DEC-058).
// The routes behind each section check the same permissions again.
export type WorkspaceSection = 'dashboard' | 'documents' | 'training' | 'users-management' | 'audit';

export function workspaceSections(permissions: readonly string[] | undefined): WorkspaceSection[] {
  const granted = new Set(permissions ?? []);
  return [
    'dashboard',
    'documents',
    'training',
    ...(granted.has('users.read') ? ['users-management' as const] : []),
    ...(granted.has('audit.read') ? ['audit' as const] : []),
  ];
}
