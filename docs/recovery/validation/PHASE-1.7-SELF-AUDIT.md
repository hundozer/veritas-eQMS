# Phase 1.7 Self-Audit — Protected Isolated Preview

Date: 2026-08-25

## Scope and outcome

Push the reviewed recovery tree, bind its Vercel Preview environment only to the
isolated Neon recovery branch, deploy behind access protection, and run UI/API/
database negative checks. Outcome: passed after correcting one hostname defect.

## Self-audit

- A temporary branch-only `git.deploymentEnabled=false` commit prevented an
  automatic deployment before the branch-scoped database variable existed.
- The final deployable commit used tree `6de6f86983a193735526ddfd0be143204b46338d`,
  exactly matching the audited candidate tree.
- Public requests redirected to Vercel authentication. Authenticated inspection
  rendered the recovery landing page and member sign-in modal.
- Session and document requests without application authentication returned 401;
  a nonexistent-user login returned the generic 401 response.
- The first manually assembled Neon hostname used the wrong regional suffix. The
  audit detected the failed direct connection, replaced the Vercel secret with a
  suffix-preserving derived hostname, rebuilt, and repeated all checks.
- Corrected isolated state remained 12 migrations, 0 failed, 3 documents, 1 user,
  1 membership, and 0 sessions.
- No production database, alias, domain, or production environment variable was
  changed.

Closure status: **closed for protected isolated preview**. Production remains
**NO-GO**.
