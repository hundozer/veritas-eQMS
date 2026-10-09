import { describe, expect, it } from 'vitest';
import { parseTrainingDepartments } from './training-assignment';

describe('training departments', () => {
  it('TRN-T004 the stored list is split into distinct trimmed names, first spelling kept', () => {
    expect(parseTrainingDepartments(' QA, Production,qa ,, ')).toEqual(['QA', 'Production']);
    expect(parseTrainingDepartments('')).toEqual([]);
    expect(parseTrainingDepartments(undefined)).toEqual([]);
    expect(parseTrainingDepartments(['QA'])).toEqual([]);
  });
});
