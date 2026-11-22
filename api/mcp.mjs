import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createReceiptServer } from '../mcp/receipt-tool.mjs';

const publicOrigin = 'https://breakpoint.beer';
const responseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function rpcError(status, message, headers = {}) {
  return Response.json({
    jsonrpc: '2.0',
    error: { code: status === 500 ? -32603 : -32000, message },
    id: null
  }, { status, headers: { ...responseHeaders, ...headers } });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    if (origin !== null && origin !== publicOrigin) return rpcError(403, 'Forbidden origin.');
    if (request.method !== 'POST') return rpcError(405, 'Use POST with an MCP client.', { Allow: 'POST' });

    // This calculator has no sessions, event store, or input logging.
    const server = createReceiptServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      maxRequestBodySize: 8192
    });

    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(responseHeaders)) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return rpcError(500, 'MCP request failed.');
    } finally {
      await server.close();
    }
  }
};
