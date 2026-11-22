import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import mcp from '../api/mcp.mjs';

const liveUrl = process.env.BP26_MCP_TEST_URL;
const endpoint = new URL(liveUrl ?? 'https://breakpoint.beer/mcp');
const request = liveUrl ? globalThis.fetch : (input, init) => mcp.fetch(new Request(input, init));
const sample = { pints: 5, cigs: 6, favors: 1, sleep: 4, leads: 10, deals: 3, value: 24000, sideEvents: 3 };
const expected = {
  score: 69,
  rating: 'Perfect score',
  finding: 'Approved in full.',
  challengeUrl: 'https://breakpoint.beer/?beat=69'
};
const canary = 'synthetic-mcp-test-' + randomUUID();

test('an MCP client calculates the documented receipt over stateless HTTP', async t => {
  const requests = [];
  const transport = new StreamableHTTPClientTransport(endpoint, {
    fetch: async (input, init) => {
      const response = await request(input, init);
      requests.push({
        status: response.status,
        caching: response.headers.get('Cache-Control'),
        session: response.headers.has('Mcp-Session-Id')
      });
      return response;
    }
  });
  const client = new Client({ name: 'breakpoint-http-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['calculate_receipt']);
  assert.equal(tools[0].inputSchema.additionalProperties, false);
  const calculate = args => client.callTool({ name: 'calculate_receipt', arguments: args });
  const receipt = await calculate(sample);
  assert.deepEqual(receipt.structuredContent, expected);
  assert.deepEqual(receipt.content, [{ type: 'text', text: JSON.stringify(expected) }]);

  const nextReceipt = await calculate({ sleep: 8 });
  assert.equal(nextReceipt.structuredContent.score, 7.1);
  const rawRecords = await calculate({ sleep: 8, whoopRecords: [canary] });
  assert.equal(rawRecords.isError, true);
  assert.equal(rawRecords.structuredContent, undefined);
  assert(!JSON.stringify(rawRecords).includes(canary));
  assert(requests.some(reply => reply.status === 202));
  for (const reply of requests) {
    assert.match(reply.caching ?? '', /\bno-store\b/);
    assert.equal(reply.session, false);
  }
});

test('HTTP errors are uncached and do not echo malformed input', async () => {
  const call = (body, origin) => request(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {})
    },
    body
  });
  const replies = [
    [405, await request(endpoint, { headers: { Accept: 'text/event-stream' } })],
    [403, await call('{}', 'https://example.com')],
    [400, await call('{"value":'+canary)],
    [413, await call(canary.repeat(400))]
  ];
  for (const [status, response] of replies) {
    assert.equal(response.status, status);
    assert.match(response.headers.get('Cache-Control') ?? '', /\bno-store\b/);
    assert(!(await response.text()).includes(canary));
  }
  assert.equal(replies[0][1].headers.get('Allow'), 'POST');
});
