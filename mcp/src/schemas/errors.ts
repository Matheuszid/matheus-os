export function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Missing required environment variable')) {
    return { error: 'CONFIGURATION_ERROR', message: 'MCP server configuration is incomplete.' };
  }
  return { error: 'INTERNAL_ERROR', message: 'The Matheus OS operation could not be completed.' };
}
