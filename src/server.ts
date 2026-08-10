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
 * Builds the MCP server with its tools wired to a HoodGrowClient. Kept
 * separate from the stdio entrypoint (index.ts) so tests can call tool
 * handlers directly without spinning up a transport.
 */
export function createServer(clientOptions: HoodGrowClientOptions): McpServer {
  const client = new HoodGrowClient(clientOptions);

  const server = new McpServer({
    name: "hoodgrow-mcp",
    version: "0.4.0",
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

  server.registerTool(
    "get_defi",
    {
      title: "Get HoodGrow token DeFi detail",
      description:
        "Every Morpho lending market (as loan asset OR collateral, both roles labeled) " +
        "and Uniswap V3 pool involving one token — the full picture for comparing yield/ " +
        "borrow options, not just the single best-APY figure in get_catalog/get_token. " +
        "$0.05 via x402, free with an API key. Fails for an unknown symbol.",
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getDefi(symbol));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_holders",
    {
      title: "Get HoodGrow token holder analytics",
      description:
        "Holder-count trend, 24h net total_supply change (real mint/burn — creation/ " +
        "redemption of the underlying tokenized shares, distinct from a corporate-action " +
        "multiplier change), and top-holder concentration for one token. $0.05 via x402, " +
        "free with an API key. Fails for an unknown symbol.",
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("How many top holders to return, 1-50. Defaults to 10."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol, limit }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getHolders(symbol, limit));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_slippage",
    {
      title: "Get HoodGrow trade price-impact estimate",
      description:
        "How much a USD-sized trade would move the price, per Uniswap V3 pool this " +
        "token trades on — plus bestPoolAddress/bestEffectivePrice picking the best " +
        "of them for you. Per-pool estimate, not an optimal multi-pool route/split. " +
        "Exact within each pool's currently active tick range; a likelyCrossesTick flag " +
        "on a result means the trade is probably large enough that this may understate " +
        "real slippage — consider splitting into smaller tranches (TWAP) instead. " +
        "$0.05 via x402, free with an API key. Fails for an unknown symbol.",
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
        amountUsd: z.number().positive().describe("Trade size in USD."),
        side: z
          .enum(["buy", "sell"])
          .describe('"buy" spends USDG for the stock token, "sell" spends the stock token for USDG.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol, amountUsd, side }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getSlippage(symbol, amountUsd, side));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_ohlc",
    {
      title: "Get HoodGrow OHLC price candles",
      description:
        "OHLC price candles for backtesting, bucketed from price history already " +
        "collected every ~15 min. OHLC only, no volume — HoodGrow has no historical " +
        "trading-volume time series to draw a volume field from. Defaults to the last " +
        "30 days if from/to are omitted; window capped at 730 days. $0.05 via x402, " +
        "free with an API key. Fails for an unknown symbol.",
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
        interval: z.enum(["1h", "4h", "1d"]).describe("Candle bucket size."),
        from: z.string().optional().describe("ISO 8601 start (default: 30 days before `to`)."),
        to: z.string().optional().describe("ISO 8601 end (default: now)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max candles to return, 1-1000. Defaults to 500."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol, interval, from, to, limit }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getOhlc(symbol, interval, { from, to, limit }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_base_tokens",
    {
      title: "Get HoodGrow Base B20 token registry",
      description:
        "Base mainnet (chain 8453) B20 native-equity-token registry — verified " +
        "on-chain metadata (symbol, name, decimals) for a fixed set of known " +
        "tokens, plus a liveness signal. PRE-LAUNCH: every token currently has " +
        "zero minted supply — no price, no DEX liquidity, no holders exist yet. " +
        "status flips to \"live\" automatically once totalSupply() > 0 on-chain; " +
        "do not treat a pre_launch entry as tradable. $0.05 via x402, free with " +
        "an API key.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        return textResult(await client.getBaseTokens());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "list_credit_bundles",
    {
      title: "List HoodGrow prepaid credit bundles",
      description:
        "Current prepaid credit bundle catalog ({id: {priceUsd, creditUsd}}) — free, " +
        "no credentials required. A bundle is paid once via x402 (buy_credits) and " +
        "spent down over many calls afterward via a cheap wallet signature instead " +
        "of a fresh on-chain payment per call — see HOODGROW_USE_CREDITS.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        return textResult(await client.listCreditBundles());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "buy_credits",
    {
      title: "Buy a HoodGrow prepaid credit bundle",
      description:
        "Pays for one prepaid credit bundle via x402 (see list_credit_bundles for " +
        "ids/prices) — a REAL, irreversible USDC payment on Base mainnet. Requires " +
        "HOODGROW_PRIVATE_KEY to be configured (a bearer-key setup is already free " +
        "and has no use for credits). The balance lands once settlement confirms; " +
        "call get_credit_balance to verify. To actually start spending it instead " +
        "of paying x402 per call, set HOODGROW_USE_CREDITS=true and restart this " +
        "server.",
      inputSchema: {
        bundleId: z
          .string()
          .min(1)
          .describe('Bundle id from list_credit_bundles, e.g. "10", "50", "200".'),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ bundleId }): Promise<CallToolResult> => {
      try {
        return textResult(await client.buyCredits(bundleId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_credit_balance",
    {
      title: "Get HoodGrow prepaid credit balance",
      description:
        "This wallet's current prepaid credit balance — free (no x402 charge, no " +
        "credit spend). Requires HOODGROW_PRIVATE_KEY to be configured.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        return textResult(await client.getCreditBalance());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}
