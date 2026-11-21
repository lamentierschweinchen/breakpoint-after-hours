import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('the local MCP tool validates and scores a receipt over stdio', async t => {
  const client = new Client({ name: 'breakpoint-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../server.mjs', import.meta.url))]
  });
  t.after(() => client.close());
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['calculate_receipt']);
  const [tool] = tools;
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.openWorldHint, false);
  assert.equal(tool.inputSchema.additionalProperties, false);
  const calculate = args => client.callTool({ name: tool.name, arguments: args });

  const receipt = await calculate({
    pints: 5, cigs: 6, favors: 1, sleep: 4, leads: 10, deals: 3, value: 24000, sideEvents: 3
  });
  const expected = {
    score: 69,
    rating: 'Perfect score',
    finding: 'Approved in full.',
    challengeUrl: 'https://breakpoint.beer/?beat=69'
  };
  assert.deepEqual(receipt.structuredContent, expected);
  assert.deepEqual(receipt.content, [{ type: 'text', text: JSON.stringify(expected) }]);

  assert.equal((await calculate({ sleep: 8 })).structuredContent.score, 7.1);
  assert.equal((await calculate({ sleep: 0 })).structuredContent.score, 16);
  const zero = (await calculate({ pints: 0 })).structuredContent;
  assert.equal(zero.score, 0);
  assert.equal(zero.challengeUrl, 'https://breakpoint.beer/?beat=0');

  for (const invalid of [{}, { sleep: 25 }, { cigs: 1.5 }, { value: -1 }, { sleep: '8' }]) {
    assert.equal((await calculate(invalid)).isError, true);
  }
  const rawRecords = await calculate({ sleep: 8, whoopRecords: ['private-record-marker'] });
  assert.equal(rawRecords.isError, true);
  assert.equal(rawRecords.structuredContent, undefined);
  assert(!JSON.stringify(rawRecords).includes('private-record-marker'));
});
