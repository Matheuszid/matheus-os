import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

const server = createServer();
await server.connect(new StdioServerTransport());
console.error('INFO MCP started service=matheus-os-mcp transport=stdio');
