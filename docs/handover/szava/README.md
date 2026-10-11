# Handover package for Száva

Start here: **[VERITAS_DEVELOPMENT_HANDOVER.md](VERITAS_DEVELOPMENT_HANDOVER.md)**
(the entry point, with the starter prompt for your AI at the end).

| File | Purpose |
| --- | --- |
| [VERITAS_DEVELOPMENT_HANDOVER.md](VERITAS_DEVELOPMENT_HANDOVER.md) | Product, roadmap, architecture, design, workflow integration, standards, protocol, definition of done, starter prompt |
| [MVP_ROADMAP.md](MVP_ROADMAP.md) | VER-00 … VER-07 and VER-DS-01: acceptance criteria, dependencies, status with evidence |
| [ARCHITECTURE_AND_API_CONTRACTS.md](ARCHITECTURE_AND_API_CONTRACTS.md) | The contracts a module codes against: request pipeline, API shapes, errors, data, audit, signatures, graph (proposed) |
| [DESIGN_SYSTEM_REFERENCE.md](DESIGN_SYSTEM_REFERENCE.md) | One-page token and style reference; links to `docs/design-system/` |
| [COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) | Which component to use for what; links to the full inventory |
| [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) | TypeScript, React, server/client, API, Prisma, migrations, isolation, security, testing, dependencies |
| [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md) | Definition of done and the pull-request checklist to paste |
| [examples/](examples/) | Type-checked code to copy: route, workflow action, lifecycle, permission-aware actions, list, detail, create dialog |
| [visual-references/](visual-references/) | Screenshots of the implemented application and showcase, labelled |

The repository is authoritative; this folder is a snapshot that links back to
it. A portable archive of it can be rebuilt from any commit with
`scripts/handover-archive.sh` (tracked files only, so no secrets or build
output can enter it).
