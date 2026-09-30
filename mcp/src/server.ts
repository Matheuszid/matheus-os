import { McpServer } from '@modelcontextprotocol/server';
import { registerActionTools } from './tools/actions.js';
import { registerCaptureTools } from './tools/captures.js';
import { registerProjectTools } from './tools/projects.js';

export function createServer() {
  const server = new McpServer({ name: 'matheus-os-mcp', version: '0.1.0' });
  registerProjectTools(server);
  registerCaptureTools(server);
  registerActionTools(server);
  return server;
}
