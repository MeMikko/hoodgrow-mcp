#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { clientOptionsFromEnv } from "./config.js";

async function main() {
  const server = createServer(clientOptionsFromEnv());
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error("hoodgrow-mcp failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
});
