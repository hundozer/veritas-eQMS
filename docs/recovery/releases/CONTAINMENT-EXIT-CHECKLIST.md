# Repository Containment Exit Checklist

Date: 2026-08-25
Decision: `DEC-042`

## Repository exit decision

Repository containment is complete when Phase 0.38's full gate passes. This means unsafe or unsupported repository capabilities are fail-closed or removed, retained reads have explicit authorization/tenant boundaries, public claims are qualified, and regression contracts protect the containment boundary.

Repository exit by itself **does not authorize production deployment, a customer
pilot, regulated reliance, or a compliance claim**. The later containment-only
deployment authorization is recorded in `DEC-052`.

## Containment exit criteria

- [x] Public tenant provisioning, registration, SSO, demo collection, platform administration, and unfinished intelligence routes fail closed.
- [x] Change control, deviation/CAPA, training sign-off, document release, unsafe exports, user administration, audit scheduling, equipment/supplier mutations, and invalid electronic signatures are disabled and removed from shipped UI paths.
- [x] Runtime capability checks use permissions loaded from the validated active IAM membership; legacy client identity headers/cookies and the operational-role ABAC grant helper are removed.
- [x] Retained document, training, audit, notification, audit-plan, equipment, supplier, and user reads are tenant-scoped and field-minimized under their documented permissions.
- [x] Controlled files are outside the public web root and retrieved through authorized, integrity-checked, non-cacheable routes.
- [x] Controlled-copy HTML uses tenant-scoped lookup, explicit projection, output escaping, and restrictive CSP.
- [x] Raw exception/log leakage is bounded by safe responses and the controlled event interface.
- [x] Unsupported performance, active-control, signature, inspection-package, immutability/completeness, and compliance-readiness claims are removed or expressly qualified.
- [x] Every recovery phase has a retained self-audit and risk/decision traceability.
- [x] Final full repository gate evidence recorded in Phase 0.38.

## Production blockers after repository containment

Production containment was deployed on 2026-08-26. Migration, IAM disposition,
rollback-checkpoint, remote-build, and containment smoke gates are evidenced in
`PRODUCTION-CUTOVER-2026-08-26.md`. The following still block regulated or
general-availability release:

1. Remediate and independently verify the failed object-storage, database-role,
   network, secret-scope, runtime, header, monitoring, backup/restore, rollback,
   session/cookie, proxy/CDN/cache, and tenant-isolation controls recorded in
   `PRODUCTION-INFRASTRUCTURE-AUDIT-2026-08-26.md`.
2. Implement and evidence distributed login abuse controls, MFA policy, alerting, session revocation/concurrency policy, and penetration testing.
3. Implement and approve `OBS-001`–`OBS-012`, including transport, access, retention/deletion, processor/location, monitoring, and historical-log disposition.
4. Inventory and assess historical records created before containment: identities/memberships, signatures, approvals/releases, training completions, change requests, deviations/CAPAs, equipment/supplier actions, audit events/exports, public files, caches, and third-party processor histories.
5. Replace supplier inline attachment delivery with a separately authorized, non-cacheable, size/type-constrained streaming route and define retention/access logging.
6. Complete intended-use, privacy notice/DPA/subprocessor/retention/incident materials, threat model, validation plan, requirements/risk traceability, test protocols, SOPs, training, support, business continuity, and customer responsibilities.
7. Obtain independent product, security, privacy/legal, quality/validation, and operations approvals with a controlled release record. Codex self-audit cannot supply these approvals.

## Release rule

The containment candidate may remain deployed for controlled recovery and
internal verification. Until every remaining blocker has objective evidence and
approval, the correct decision is **NO-GO for regulated customer use, a customer
pilot, general availability, or compliance claims**.
