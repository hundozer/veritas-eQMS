// Training matrix (DEC-076): people as rows, documents with training as columns.
// Each cell is the person's training on the newest version they were assigned;
// superseded assignments are history and do not appear. Pure, so the Training
// Hub can render it and tests can check it without a browser.

export type MatrixAssignment = {
  id: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  documentVersion?: { versionNumber: number } | null;
  user: { id: string; fullName: string; department: string };
  requirement: { document: { id: string; documentNumber?: string | null; title: string } };
};

export type MatrixCell = { status: string; versionNumber: number | null; completedAt: string | null };

export type TrainingMatrix = {
  documents: Array<{ id: string; documentNumber?: string | null; title: string }>;
  people: Array<{ id: string; fullName: string; department: string; cells: Record<string, MatrixCell> }>;
  totals: { open: number; completed: number };
};

export function buildTrainingMatrix(assignments: MatrixAssignment[]): TrainingMatrix {
  const documents = new Map<string, TrainingMatrix['documents'][number]>();
  const people = new Map<string, TrainingMatrix['people'][number]>();
  const chosen = new Map<string, MatrixAssignment>();

  for (const assignment of assignments) {
    if (assignment.status === 'SUPERSEDED') continue;
    const key = `${assignment.user.id}\u0000${assignment.requirement.document.id}`;
    const current = chosen.get(key);
    if (!current || newer(assignment, current)) chosen.set(key, assignment);
  }

  for (const assignment of chosen.values()) {
    const { document } = assignment.requirement;
    documents.set(document.id, { id: document.id, documentNumber: document.documentNumber, title: document.title });
    const person = people.get(assignment.user.id)
      ?? { id: assignment.user.id, fullName: assignment.user.fullName, department: assignment.user.department, cells: {} };
    person.cells[document.id] = {
      status: assignment.status,
      versionNumber: assignment.documentVersion?.versionNumber ?? null,
      completedAt: assignment.completedAt,
    };
    people.set(person.id, person);
  }

  const cells = [...people.values()].flatMap((person) => Object.values(person.cells));
  return {
    documents: [...documents.values()].sort((a, b) => (a.documentNumber ?? a.title).localeCompare(b.documentNumber ?? b.title)),
    people: [...people.values()].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    totals: {
      open: cells.filter((cell) => cell.status === 'ASSIGNED').length,
      completed: cells.filter((cell) => cell.status === 'COMPLETED').length,
    },
  };
}

function newer(candidate: MatrixAssignment, current: MatrixAssignment): boolean {
  const version = (row: MatrixAssignment) => row.documentVersion?.versionNumber ?? 0;
  if (version(candidate) !== version(current)) return version(candidate) > version(current);
  return candidate.assignedAt > current.assignedAt;
}
