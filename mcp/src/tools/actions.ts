import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { toolError } from '../schemas/errors.js';
import { listProjects } from '../services/projectService.js';
import { jsonContent } from './helpers.js';

const nextActionsInput = z.object({}).strict();

export function registerActionTools(server: McpServer) {
  server.registerTool('get_next_actions', {
    description: 'Lista os menores próximos passos registrados nos projetos ativos.',
    inputSchema: nextActionsInput
  }, async () => {
    try {
      const projects = await listProjects({ status: 'active' });
      return jsonContent(projects.map((project) => ({
        projectId: project.id,
        project: project.name,
        area: project.area,
        stage: project.stage,
        nextAction: project.nextAction
      })));
    } catch (error) {
      console.error('tool=get_next_actions result=error', error instanceof Error ? error.message : 'unknown');
      return jsonContent(toolError(error));
    }
  });
}
