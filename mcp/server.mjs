import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createReceiptServer } from './receipt-tool.mjs';

await createReceiptServer().connect(new StdioServerTransport());
