import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { HoodGrowClient, HoodGrowError, type HoodGrowClientOptions } from "hoodgrow";

function textResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown): CallToolResult {
  if (error instanceof HoodGrowError) {
    return {
      isError: true,
      content: [{ type: "text", text: `HoodGrow API error (${error.status}): ${error.message}` }],
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Builds the MCP server with its three tools wired to a HoodGrowClient.
 * Kept separate from the stdio entrypoint (index.ts) so tests can call
 * tool handlers directly without spinning up a transport.
 */
export function createServer(clientOptions: HoodGrowClientOptions): McpServer {
  const client = new HoodGrowClient(clientOptions);

  const server = new McpServer({
    name: "hoodgrow-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_catalog",
    {
      title: "Get HoodGrow token catalog",
      description:
        "Full catalog of Robinhood Chain stock tokens: live price, corporate-action " +
        "adjusted supply, DeFi depth (best Morpho supply APY, Uniswap V3 TVL), and " +
        "pending/recent corporate actions for every listed token. Paid per call " +
        "($0.10 via x402, free with an API key) — prefer get_token for a single symbol.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        return textResult(await client.getCatalog());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_token",
    {
      title: "Get one HoodGrow token",
      description:
        "One Robinhood Chain stock token by symbol (e.g. NVDA): live price, " +
        "corporate-action adjusted supply, DeFi depth, and pending/recent " +
        "corporate actions. Cheaper than get_catalog for a single spot check " +
        "($0.05 via x402, free with an API key). Fails for an unknown symbol.",
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getToken(symbol));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_corporate_actions",
    {
      title: "Get HoodGrow corporate actions",
      description:
        "Pending (on-chain staged) and recent (official Robinhood ledger) corporate " +
        "actions — splits, dividends, name changes. Pass a symbol to scope to one " +
        "token (cheaper); omit it for every tracked token's corporate actions.",
      inputSchema: {
        symbol: z
          .string()
          .min(1)
          .optional()
          .describe("Ticker symbol to scope to, e.g. \"NVDA\". Omit for all tokens."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getCorporateActions(symbol));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}
