import { z } from 'zod';

export const areas = ['Trabalho', 'Negócios', 'Estudos', 'Pessoal', 'Finanças', 'Relações', 'Saúde'] as const;
export const stages = ['Capturar', 'Entender', 'Mapear', 'Decidir', 'Agir', 'Medir e aprender'] as const;

export const projectIdSchema = z.string().trim().min(1).max(120);
export const stageSchema = z.enum(stages);

export function stageNameToIndex(stage: string): number {
  const index = stages.indexOf(stage as typeof stages[number]);
  if (index < 0) throw new Error(`Invalid stage: ${stage}`);
  return index;
}

export function stageIndexToName(stage: unknown): string {
  const index = typeof stage === 'number' ? stage : Number(stage);
  return stages[index] || 'Capturar';
}

export function serializeValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}