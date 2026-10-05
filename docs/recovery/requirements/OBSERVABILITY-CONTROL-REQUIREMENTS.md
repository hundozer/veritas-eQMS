# Observability Control Requirements

Status: recovery baseline; implementation and approval pending
Date: 2026-08-24

These requirements apply before Veritas server events may be relied on in a pilot or production deployment.

| ID | Requirement | Required evidence |
| --- | --- | --- |
| OBS-001 | All application server events shall pass through the controlled event interface; direct console use outside that module is prohibited. | Static contract and code review. |
| OBS-002 | Allowed application fields are limited to ISO timestamp, severity, allow-listed event name, and random event/error correlation ID. No exception, stack, request, identity, tenant, record, payload, file, storage key, credential, token, or arbitrary metadata is permitted. | Schema tests, negative tests, sampled deployed events. |
| OBS-003 | The production transport and processor shall be explicitly approved, documented, and configured per environment. Development events shall not be mixed with production events. | Architecture record, processor assessment, environment configuration evidence. |
| OBS-004 | Human and machine access shall use least privilege, named identities, MFA where supported, periodic access review, and recorded administrative changes. | Role matrix, access export, review record, provider configuration. |
| OBS-005 | A retention period and deletion method shall be approved before production. Default/provider-indefinite retention is prohibited. Legal hold handling and backup expiry shall be documented. | Approved retention schedule, configured retention, deletion test. |
| OBS-006 | Processing region, cross-border transfer basis where applicable, subprocessors, encryption in transit/at rest, and incident notification terms shall be reviewed by privacy/security owners. | Contract/DPA and security review evidence. |
| OBS-007 | Alerts shall use allow-listed event names and aggregate thresholds without adding sensitive fields. Alert destinations and responders shall be approved. | Alert rules, routing test, on-call ownership. |
| OBS-008 | Operational procedures shall cover correlation lookup, triage, escalation, incident preservation, false positives, and customer communication without requesting secrets or regulated payloads. | Approved runbook and exercise evidence. |
| OBS-009 | Event delivery failure shall not silently change regulated business outcomes. Mandatory GxP audit evidence must remain transactional in the audit system and shall not depend on console/observability delivery. | Failure-injection tests and audit architecture review. |
| OBS-010 | Observability events are operational signals, not electronic records, electronic signatures, or authoritative audit-trail evidence. Any future use as regulated evidence requires separate intended use, controls, validation, retention, and review. | Quality approval and validation assessment. |
| OBS-011 | Historical logs from pre-containment deployments shall be inventoried, access-restricted, assessed for sensitive content, and retained or deleted under approved legal/privacy/security direction. | Inventory, access review, disposition record. |
| OBS-012 | Deployment approval shall include sampled verification that emitted JSON matches the application schema and that client-visible error IDs can be located without exposing unrelated tenant or user activity. | Release protocol and executed evidence. |

## Current implementation boundary

- Error events: `{ timestamp, level: "error", event, errorId }`.
- Notice events: `{ timestamp, level: "info", event, eventId }`.
- Event names are TypeScript literal unions.
- Callers cannot supply an exception or metadata object.
- The current console transport is only an adapter to the deployment runtime and is not itself an approved control package.
