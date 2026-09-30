import { describe, expect, it } from 'vitest';
import { stageIndexToName, stageNameToIndex } from '../src/schemas/common.js';
import { addCaptureInput } from '../src/schemas/capture.js';
import { getProjectInput, listProjectsInput } from '../src/schemas/project.js';

describe('Matheus OS MCP Phase 1 contracts', () => {
  it('list_projects accepts only supported filters', () => {
    expect(listProjectsInput.parse({ area: 'Estudos', stage: 'Agir', status: 'active' })).toEqual({ area: 'Estudos', stage: 'Agir', status: 'active' });
    expect(() => listProjectsInput.parse({ status: 'archived' })).toThrow();
  });

  it('get_project requires an id or name', () => {
    expect(getProjectInput.parse({ projectId: 'matheus-os' }).projectId).toBe('matheus-os');
    expect(getProjectInput.parse({ name: 'Matheus OS' }).name).toBe('Matheus OS');
    expect(() => getProjectInput.parse({})).toThrow();
  });

  it('add_capture rejects empty and oversized text', () => {
    expect(addCaptureInput.parse({ text: 'Estudar redes' }).text).toBe('Estudar redes');
    expect(() => addCaptureInput.parse({ text: '' })).toThrow();
    expect(() => addCaptureInput.parse({ text: 'x'.repeat(501) })).toThrow();
  });

  it('get_next_actions uses the same human stage names as the frontend', () => {
    expect(stageIndexToName(4)).toBe('Agir');
    expect(stageNameToIndex('Medir e aprender')).toBe(5);
  });
});
