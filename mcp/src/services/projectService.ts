import { db } from '../firebase.js';
import { config } from '../config.js';
import { serializeValue, stageIndexToName, stageNameToIndex } from '../schemas/common.js';

const projectsRef = () => db.collection('users').doc(config.uid).collection('projects');

export type ProjectSummary = {
  id: string;
  name: string;
  area: string;
  stage: string;
  status: string;
  nextAction: string;
};

function compactProject(id: string, data: Record<string, unknown>): ProjectSummary {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : id,
    area: typeof data.area === 'string' ? data.area : '',
    stage: stageIndexToName(data.stage),
    status: typeof data.status === 'string' ? data.status : 'active',
    nextAction: typeof data.nextAction === 'string' ? data.nextAction : ''
  };
}

export async function listProjects(filters: { area?: string; stage?: string; status?: 'active' | 'completed' } = {}) {
  const snapshot = await projectsRef().get();
  return snapshot.docs
    .map((item) => compactProject(item.id, item.data()))
    .filter((project) => !filters.area || project.area === filters.area)
    .filter((project) => !filters.stage || project.stage === filters.stage)
    .filter((project) => !filters.status || project.status === filters.status);
}

export async function getProjectById(projectId: string) {
  const snapshot = await projectsRef().doc(projectId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function findProjectsByName(name: string) {
  const projects = await listProjects();
  const normalized = name.trim().toLocaleLowerCase();
  return projects.filter((project) => project.name.toLocaleLowerCase() === normalized);
}

export async function getProjectContext(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) return null;
  const projectRef = projectsRef().doc(projectId);
  const [answersSnapshot, learningsSnapshot] = await Promise.all([
    projectRef.collection('answers').get(),
    projectRef.collection('learnings').get()
  ]);
  const relationsSnapshot = await db.collection('users').doc(config.uid).collection('relations').get();
  const relations = relationsSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as { id: string; from?: string; to?: string })
    .filter((relation) => relation.from === projectId || relation.to === projectId);
  const data = project as Record<string, unknown>;
  return {
    project: {
      id: projectId,
      name: data.name || projectId,
      area: data.area || '',
      stage: stageIndexToName(data.stage),
      status: data.status || 'active',
      goal: data.goal || '',
      nextAction: data.nextAction || '',
      createdAt: serializeValue(data.createdAt),
      updatedAt: serializeValue(data.updatedAt)
    },
    answers: answersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    learnings: learningsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    relations
  };
}

export { compactProject, stageNameToIndex };