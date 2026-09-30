import { McpServer } from '@modelcontextprotocol/server';
import { addCaptureInput } from '../schemas/capture.js';
import { toolError } from '../schemas/errors.js';
import { addCapture } from '../services/captureService.js';
import { jsonContent } from './helpers.js';

export function registerCaptureTools(server: McpServer) {
  server.registerTool('add_capture', {
    description: 'Adiciona uma ideia à captura rápida do Matheus OS.',
    inputSchema: addCaptureInput
  }, async ({ text }) => {
    try {
      const result = await addCapture(text);
      console.error(`tool=add_capture result=success captureId=${result.id}`);
      return jsonContent(result);
    } catch (error) {
      console.error('tool=add_capture result=error', error instanceof Error ? error.message : 'unknown');
      return jsonContent(toolError(error));
    }
  });
}
