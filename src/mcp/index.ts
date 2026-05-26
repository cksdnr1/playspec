#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from './server.js';

const workspaceRoot = process.cwd();
const server = buildMcpServer(workspaceRoot);
const transport = new StdioServerTransport();
await server.connect(transport);
