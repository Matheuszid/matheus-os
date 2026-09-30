import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { config } from './config.js';

type Session = {
  transport: WebStandardStreamableHTTPServerTransport;
};

const sessions = new Map<string, Session>();

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function authorized(request: IncomingMessage) {
  if (!config.apiKey) return false;
  return request.headers.authorization === `Bearer ${config.apiKey}`;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function toWebHeaders(request: IncomingMessage) {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) headers.set(name, value.join(', '));
    else if (value) headers.set(name, value);
  });
  return headers;
}

async function handleMcp(request: IncomingMessage, response: ServerResponse) {
  if (!authorized(request)) return writeJson(response, config.apiKey ? 401 : 503, { error: 'MCP_AUTH_REQUIRED' });

  const sessionId = typeof request.headers['mcp-session-id'] === 'string' ? request.headers['mcp-session-id'] : undefined;
  let session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) {
    const { createServer } = await import('./server.js');
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (initializedSessionId) => {
        if (session) sessions.set(initializedSessionId, session);
      }
    });
    const server = createServer();
    await server.connect(transport);
    session = { transport };
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
  }

  const body = await readBody(request);
  const url = `http://${request.headers.host || 'localhost'}${request.url || '/mcp'}`;
  const webRequest = new Request(url, {
    method: request.method,
    headers: toWebHeaders(request),
    body: body.length ? body : undefined,
    duplex: 'half'
  } as RequestInit);
  const webResponse = await session.transport.handleRequest(webRequest);
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.writeHead(webResponse.status);
  if (webResponse.body) Readable.fromWeb(webResponse.body as any).pipe(response);
  else response.end();
}

const httpServer = createHttpServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      return writeJson(response, 200, { ok: true, service: 'matheus-os-mcp' });
    }
    if (request.url?.split('?')[0] === '/mcp') return await handleMcp(request, response);
    writeJson(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    console.error('ERROR http request', error instanceof Error ? error.message : 'unknown');
    writeJson(response, 500, { error: 'INTERNAL_ERROR', message: 'MCP request failed.' });
  }
});

httpServer.listen(config.port, '0.0.0.0', () => {
  console.error(`INFO MCP started service=matheus-os-mcp transport=http port=${config.port}`);
});
