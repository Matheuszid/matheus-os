import { McpServer } from '@modelcontextprotocol/server';
import { getProjectInput, listProjectsInput } from '../schemas/project.js';
import { toolError } from '../schemas/errors.js';
import { findProjectsByName, getProjectContext, listProjects } from '../services/projectService.js';
import { jsonContent } from './helpers.js';

export function registerProjectTools(server: McpServer) {
  server.registerTool('list_projects', {
    description: 'Lista os projetos do Matheus OS com filtros opcionais. Não retorna respostas completas.',
    inputSchema: listProjectsInput
  }, async (input) => {
    try {
      return jsonContent(await listProjects(input));
    } catch (error) {
      console.error('tool=list_projects result=error', error instanceof Error ? error.message : 'unknown');
      return jsonContent(toolError(error));
    }
  });

  server.registerTool('get_project', {
    description: 'Consulta um projeto do Matheus OS por ID ou nome e retorna seu contexto compacto.',
    inputSchema: getProjectInput
  }, async (input) => {
    try {
      let projectId = input.projectId;
      if (!projectId && input.name) {
        const matches = await findProjectsByName(input.name);
        if (matches.length > 1) return jsonContent({ error: 'AMBIGUOUS_PROJECT', message: 'Encontrei mais de um projeto com esse nome.', matches });
        if (!matches.length) return jsonContent({ error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' });
        projectId = matches[0].id;
      }
      const result = await getProjectContext(projectId!);
      if (!result) return jsonContent({ error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' });
      return jsonContent(result);
    } catch (error) {
      console.error('tool=get_project result=error', error instanceof Error ? error.message : 'unknown');
      return jsonContent(toolError(error));
    }
  });
}
