import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPack, readResults, riskClass, trace, type Requirement } from './validation-pack';

const requirement = (id: string, tests: string[], severity = 3, likelihood = 2): Requirement => ({
  id, area: 'Access', requirement: `${id} statement`, source: 'DEC-001', hazard: 'harm', severity, likelihood, control: 'control', tests,
});
const report = (tests: Array<[string, string]>) => ({
  testResults: [{ name: '/repo/src/lib/a.test.ts', assertionResults: tests.map(([title, status]) => ({ title, status, duration: 3.4 })) }],
});
const context = { commit: 'abc123', generatedAt: new Date('2026-10-10T10:00:00.000Z'), runner: 'Node test' };

describe('validation pack', () => {
  it('VPACK-T001 test IDs are read from test titles; files are made relative', () => {
    const results = readResults(report([['AUTH-T001: missing credentials', 'passed'], ['LOGIN-LIM-T002 an unknown email', 'failed'], ['untitled behaviour', 'passed']]), 'Unit tests', '/repo');
    expect(results.map((result) => [result.id, result.status, result.file, result.durationMs])).toEqual([
      ['AUTH-T001', 'passed', 'src/lib/a.test.ts', 3],
      ['LOGIN-LIM-T002', 'failed', 'src/lib/a.test.ts', 3],
      [null, 'passed', 'src/lib/a.test.ts', 3],
    ]);
  });

  it('VPACK-T002 risk class follows severity times likelihood', () => {
    expect([riskClass(3, 2), riskClass(3, 3), riskClass(3, 1), riskClass(2, 2), riskClass(2, 1), riskClass(1, 1)])
      .toEqual(['High', 'High', 'Medium', 'Medium', 'Low', 'Low']);
  });

  it('VPACK-T003 a requirement is verified only when every linked test ran and passed', () => {
    const results = readResults(report([['A-T001 ok', 'passed'], ['B-T001 broken', 'failed'], ['C-T001 twin', 'passed'], ['C-T001 twin again', 'failed']]), 'Unit tests');
    const traces = trace([requirement('URS-1', ['A-T001']), requirement('URS-2', ['A-T001', 'B-T001']), requirement('URS-3', ['Z-T999']), requirement('URS-4', []), requirement('URS-5', ['C-T001'])], results);
    expect(traces.map((item) => [item.requirement.id, item.verdict, item.problems])).toEqual([
      ['URS-1', 'verified', []],
      ['URS-2', 'not verified', ['B-T001 did not pass']],
      ['URS-3', 'not verified', ['Z-T999 was not found in the test run']],
      ['URS-4', 'not verified', ['no test is linked']],
      ['URS-5', 'not verified', ['C-T001 did not pass']],
    ]);
  });

  it('VPACK-T004 the pack holds the four documents and says plainly whether it is complete', () => {
    const results = readResults(report([['A-T001 ok', 'passed']]), 'Unit tests');
    const complete = buildPack([requirement('URS-1', ['A-T001'])], results, context);
    expect(complete.complete).toBe(true);
    expect(Object.keys(complete.files)).toEqual(['README.md', 'URS.md', 'risk-assessment.md', 'traceability-matrix.md', 'OQ-execution.md']);
    expect(complete.files['README.md']).toContain('all requirements verified, all tests passed');
    expect(complete.files['URS.md']).toContain('| URS-1 | URS-1 statement | DEC-001 |');
    expect(complete.files['risk-assessment.md']).toContain('| URS-1 | harm | 3 | 2 | High | control | 1 tests |');
    expect(complete.files['traceability-matrix.md']).toContain('| URS-1 | High | A-T001 (passed) | Verified |');
    expect(complete.files['OQ-execution.md']).toContain('1 tests executed: 1 passed, 0 failed, 0 skipped.');
    for (const content of Object.values(complete.files)) {
      expect(content).toContain('Commit `abc123`');
      expect(content).toContain('it is not an approval');
    }

    const incomplete = buildPack([requirement('URS-1', ['A-T001', 'Z-T999'])], results, context);
    expect(incomplete.complete).toBe(false);
    expect(incomplete.files['README.md']).toContain('**Result: NOT complete**');
    expect(incomplete.files['README.md']).toContain('- URS-1: Z-T999 was not found in the test run');
  });

  it('VPACK-T005 the repository requirements are well formed: unique IDs, ratings 1 to 3, at least one test each', () => {
    const { requirements } = JSON.parse(readFileSync('docs/validation/requirements.json', 'utf8')) as { requirements: Requirement[] };
    expect(new Set(requirements.map((item) => item.id)).size).toBe(requirements.length);
    for (const item of requirements) {
      expect([item.severity, item.likelihood].every((rating) => [1, 2, 3].includes(rating))).toBe(true);
      expect(item.tests.length).toBeGreaterThan(0);
      expect(item.requirement && item.hazard && item.control && item.source).toBeTruthy();
    }
  });
});
