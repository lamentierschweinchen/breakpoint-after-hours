import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildReceipt, receiptCopy } from '../dist/audit.mjs';

const quantity = z.number().nonnegative();
const count = quantity.int();
const inputSchema = z.strictObject({
  pints: quantity.optional().describe('Total pints during the audit period.'),
  cigs: count.optional().describe('Total cigarettes.'),
  favors: quantity.optional().describe('Total party favors in grams.'),
  blackouts: count.optional().describe('Total blackouts.'),
  sleep: quantity.max(24).optional().describe('Average hours asleep per night, from 0 to 24.'),
  leads: count.optional().describe('Total real leads.'),
  deals: count.optional().describe('Total deals closed.'),
  value: quantity.optional().describe('Total closed deal value in US dollars.'),
  sideEvents: count.optional().describe('Total side events attended.'),
  talks: count.optional().describe('Total talks attended.')
});
const outputSchema = z.strictObject({
  score: z.number().min(0).max(100),
  rating: z.string(),
  finding: z.string(),
  challengeUrl: z.url()
});

export function createReceiptServer() {
  const server = new McpServer({ name: 'breakpoint-after-hours', version: '1.0.0' });
  server.registerTool('calculate_receipt', {
    title: 'Calculate a Breakpoint receipt',
    description: 'Calculate a Breakpoint After Hours score and rating from participant-approved totals. Omit unknown stats. For WHOOP, supply only average hours asleep per night in sleep.',
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }, entries => {
    if (!Object.keys(entries).length) {
      return { isError: true, content: [{ type: 'text', text: 'Provide at least one audit stat.' }] };
    }

    const stats = {
      pints: 0, cigs: 0, favors: 0, blackouts: 0, sleep: null,
      leads: 0, deals: 0, value: 0, sideEvents: 0, talks: 0,
      ...entries
    };
    const { score, opinion } = buildReceipt(stats, entries, 'g', new Date(), null);
    const challengeUrl = new URL('/', `https://${receiptCopy.hostname}`);
    challengeUrl.searchParams.set('beat', String(score));
    const result = {
      score,
      rating: opinion.stamp,
      finding: opinion.finding,
      challengeUrl: challengeUrl.href
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result
    };
  });
  return server;
}
