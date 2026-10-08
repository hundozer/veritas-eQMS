import { appPageSource } from '../test-support/app-pages';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = appPageSource();
const route = readFileSync(resolve('src/app/api/trainings/route.ts'), 'utf8');

describe('training UI and answer-key containment', () => {
  it('TRAINING-UI-T001 removes quiz/sign-off execution and fabricated completion claims', () => {
    expect(page).not.toContain('handleSubmitTraining');
    expect(page).not.toContain('showTrainingModal');
    expect(page).not.toContain('esignTrainingPassword');
    expect(page).not.toContain('Submit Quiz & E-Sign Complete');
    expect(page).not.toContain('Open Reader & Take Quiz');
    expect(page).not.toContain('ensuring compliance audits are training-complete');
    expect(page).toContain('Quiz and sign-off unavailable during recovery');
  });

  it('TRAINING-UI-T002 excludes quiz answer material from assignment reads', () => {
    expect(route).not.toContain('quizQuestions');
    expect(route).not.toContain('correctAnswerIndex');
    expect(route).not.toContain('esignPassword');
  });
});
