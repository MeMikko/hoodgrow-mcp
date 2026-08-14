import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  HoodGrowClient,
  HoodGrowError,
  SDK_VERSION,
  type HoodGrowClientOptions,
} from "hoodgrow";

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
/**
 * The version this server reports to MCP clients.
 *
 * Was pinned at "0.4.0" while the package shipped 0.7.1 — three releases of
 * drift, invisible because nothing reads it back. A client asking the server
 * what it is got a wrong answer, and version-gated behaviour on the client
 * side would have keyed off it.
 *
 * Kept as a literal rather than imported from package.json: under NodeNext
 * that needs resolveJsonModule plus an import assertion, and package.json sits
 * outside dist/ so the emitted path differs from the source path. A test
 * asserts this equals package.json instead, which catches the drift without
 * complicating the build.
 */
export const SERVER_VERSION = "0.8.3";

/**
 * What this package reports to the API, with the SDK it wraps kept visible.
 *
 * A named constant rather than an inline template so a test can assert it:
 * if someone drops the userAgent option in a refactor, attribution silently
 * reverts to plain SDK traffic and nothing fails — the failure would surface
 * weeks later as a usage chart that stopped distinguishing MCP users.
 */
export const CLIENT_USER_AGENT = `hoodgrow-mcp/${SERVER_VERSION} (hoodgrow-ts/${SDK_VERSION})`;

export function createServer(clientOptions: HoodGrowClientOptions): McpServer {
  // Identify this package rather than the SDK it wraps. hoodgrow >=0.12.0
  // sends its own `hoodgrow-ts/<version>` User-Agent, which would report
  // every MCP tool call as a plain SDK integration — collapsing "someone is
  // using the MCP server" and "someone is using the SDK directly" into one
  // indistinguishable bucket in the API's usage ledger. The SDK stays visible
  // in parentheses so both layers are attributable from one header.
  //
  // A caller's own userAgent still wins: clientOptions is spread last.
  const client = new HoodGrowClient({
    userAgent: CLIENT_USER_AGENT,
    ...clientOptions,
  });

  const server = new McpServer({
    name: "hoodgrow-mcp",
    version: SERVER_VERSION,
  });

  // Every tool declares all four MCP behaviour hints as explicit booleans —
  // some registries (e.g. OpenAI's directory) reject tools where any hint is
  // missing or non-boolean. Shared constants keep them consistent.
  // Does each data call move money? A bearer key spends quota, not funds.
  // Without one, every call is either a fresh x402 payment or a spend
  // against a prepaid credit balance.
  const paidPerCall = !clientOptions.apiKey;

  // READ: pure data reads — safe, hit an external API/chain.
  //
  // idempotentHint is NOT a blanket true here. MCP defines it as "repeated
  // calls with the same arguments have no additional effect on the
  // environment", and in paid mode that is false: the second call pays
  // again. This server sends no `Idempotency-Key`, so the API cannot
  // collapse the retry either — a host that treats the hint as licence to
  // retry a timed-out call would pay twice for one logical read. With a
  // bearer key the calls are free and the hint is honestly true.
  const READ = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: !paidPerCall,
    openWorldHint: true,
  } as const;
  // PAY: buy_credits makes a real, irreversible x402 payment — not read-only,
  // destructive (money leaves the wallet), and each call pays again.
  const PAY = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  } as const;
  // REGISTER: register_credit_webhook writes a webhook registration —
  // additive, not destructive, and idempotent (same url/symbols → same state).
  const REGISTER = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  } as const;

/**
 * Provenance clauses, mirroring the per-route ones the API publishes in its
 * x402 descriptions.
 *
 * An MCP client lists these strings and nothing else when it decides which
 * server's tool to reach for. Asked what it could see before paying, a
 * connected agent read back exactly these descriptions — price and a summary
 * of the fields, with no indication of where the numbers come from. That is
 * why $0.05 reads as expensive next to relayed feeds charging a tenth of it:
 * at the point of choice, nothing distinguishes them.
 *
 * ONE CLAIM PER CONSTANT, composed per tool. An earlier attempt bundled
 * "Chainlink prices AND multiplier-adjusted supply" into a single clause and
 * then attached it to tools returning neither. The argument for this data is
 * that its claims are checkable; a claim that isn't discredits the ones that
 * are, so a tool asserts only what it actually returns.
 */
const PROV_PRICE =
  " Prices are read from Chainlink feeds on-chain, not relayed from an off-chain " +
  "aggregator, and refreshed every 15 minutes — each response is that snapshot, " +
  "with observedAt giving its exact age. priceSource says which tokens resolved " +
  "a feed and which fell back.";

const PROV_SUPPLY =
  " Supply is corporate-action adjusted (totalSupply x ERC-8056 uiMultiplier), " +
  "not raw.";

const PROV_CORPORATE_ACTIONS =
  " Detected from the token contract's own ERC-8056 state every minute, ahead of " +
  "the official registry's cache, which is mirrored alongside for history.";

const PROV_DEFI =
  " Morpho market and Uniswap V3 pool state, read on-chain and snapshotted every " +
  "15 minutes.";

const PROV_HOLDERS =
  " Explorer-sourced, refreshed every 4 hours; supply changes derived from " +
  "on-chain supply snapshots.";

const PROV_SLIPPAGE =
  " Computed per pool from the most recent Uniswap V3 pool snapshot (refreshed " +
  "every 15 minutes, not read live at request time) — an estimate derived from " +
  "reserves, not a quoted or executable price.";

const PROV_TRADES =
  " Indexed from Uniswap V3 Swap events on-chain; side and USD size are derived " +
  "from the USDG leg of each swap.";

const PROV_BASE =
  " Read directly from the token contracts on Base (chain 8453) and refreshed " +
  "every 4 hours; status reflects on-chain totalSupply().";

  server.registerTool(
    "get_catalog",
    {
      title: "Get HoodGrow token catalog",
      description:
        "Full catalog of Robinhood Chain stock tokens: live price, corporate-action " +
        "adjusted supply, DeFi depth (best Morpho supply APY, Uniswap V3 TVL), and " +
        "pending/recent corporate actions for every listed token. Paid per call " +
        "($0.10 via x402, free with an API key) — prefer get_token for a single symbol." +
        PROV_PRICE +
        PROV_SUPPLY +
        PROV_CORPORATE_ACTIONS,
      inputSchema: {},
      annotations: READ,
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
        "($0.05 via x402, free with an API key). Fails for an unknown symbol." +
        PROV_PRICE +
        PROV_SUPPLY +
        PROV_CORPORATE_ACTIONS,
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
      },
      annotations: READ,
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
        "token (cheaper); omit it for every tracked token's corporate actions." +
        PROV_CORPORATE_ACTIONS,
      inputSchema: {
        symbol: z
          .string()
          .min(1)
          .optional()
          .describe("Ticker symbol to scope to, e.g. \"NVDA\". Omit for all tokens."),
      },
      annotations: READ,
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
        "$0.05 via x402, free with an API key. Fails for an unknown symbol." +
        PROV_DEFI,
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
      },
      annotations: READ,
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
        "free with an API key. Fails for an unknown symbol." +
        PROV_HOLDERS,
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
      annotations: READ,
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
        "$0.05 via x402, free with an API key. Fails for an unknown symbol." +
        PROV_SLIPPAGE,
      inputSchema: {
        symbol: z.string().min(1).describe("Ticker symbol, e.g. \"NVDA\" (case-insensitive)."),
        amountUsd: z.number().positive().describe("Trade size in USD."),
        side: z
          .enum(["buy", "sell"])
          .describe('"buy" spends USDG for the stock token, "sell" spends the stock token for USDG.'),
      },
      annotations: READ,
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
        "collected every ~15 min. Each candle also carries volumeUsd/swapCount — USD " +
        "swap volume across the token's Uniswap V3 pools, null for buckets older than " +
        "the volume indexer's backfill window. Defaults to the last 30 days if from/to " +
        "are omitted; window capped at 730 days. $0.05 via x402, free with an API key. " +
        "Fails for an unknown symbol." +
        PROV_PRICE,
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
      annotations: READ,
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
        "an API key." +
        PROV_BASE,
      inputSchema: {},
      annotations: READ,
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
    "get_markets",
    {
      title: "Get HoodGrow market movers",
      description:
        "Market movers across the Robinhood Chain stock-token catalog: top gainers and " +
        "losers by 24h price change, highest 24h swap volume, and deepest Uniswap V3 " +
        "liquidity (TVL). limit caps each list (1-50, default 10); gainers/losers can be " +
        "empty when the market is flat (e.g. weekends). $0.05 via x402, free with an API key." +
        PROV_PRICE +
        PROV_DEFI,
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max entries per list, 1-50. Defaults to 10."),
      },
      annotations: READ,
    },
    async ({ limit }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getMarkets({ limit }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_trades",
    {
      title: "Get HoodGrow recent large trades",
      description:
        "Recent large (whale) trades in Robinhood Chain stock-token Uniswap V3 pools, " +
        "newest first — each with a buy/sell side, USD size, and transaction hash. Omit " +
        "symbol for the global feed. limit caps the list (1-100, default 20). $0.05 via " +
        "x402, free with an API key." +
        PROV_TRADES,
      inputSchema: {
        symbol: z
          .string()
          .min(1)
          .optional()
          .describe("Filter to one token, e.g. \"NVDA\" (case-insensitive). Omit for the global feed."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max trades to return, 1-100. Defaults to 20."),
      },
      annotations: READ,
    },
    async ({ symbol, limit }): Promise<CallToolResult> => {
      try {
        return textResult(await client.getTrades({ symbol, limit }));
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
      inputSchema: {},
      annotations: READ,
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
      annotations: PAY,
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
      inputSchema: {},
      annotations: READ,
    },
    async (): Promise<CallToolResult> => {
      try {
        return textResult(await client.getCreditBalance());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "register_credit_webhook",
    {
      title: "Register a HoodGrow corporate-action webhook",
      description:
        "Register (or update) a credit-funded corporate-action webhook for this wallet: " +
        "HoodGrow then POSTs each matching corporate_action.* event to your url, signed " +
        "x-hoodgrow-signature (verify it before trusting the body). Requires " +
        "HOODGROW_PRIVATE_KEY. Registering is FREE — no payment here; each delivered event " +
        "is billed per-event against your prepaid credit balance (buy_credits/" +
        "get_credit_balance), so an idle webhook costs nothing. symbols restricts delivery " +
        "— and, since billing is per delivered event, what you're charged for — to just " +
        "those tokens; omit for every token's events. Returns webhookSecret (shown once — " +
        "store it). This is the credit-funded path; a Builder-subscription webhook is set " +
        "from the website instead.",
      inputSchema: {
        url: z
          .string()
          .url()
          .describe("HTTPS URL HoodGrow POSTs each corporate-action event to."),
        symbols: z
          .array(z.string().min(1))
          .optional()
          .describe(
            'Restrict delivery (and per-event billing) to these symbols, e.g. ["NVDA","INTC"]. Omit for all tokens.'
          ),
      },
      annotations: REGISTER,
    },
    async ({ url, symbols }): Promise<CallToolResult> => {
      try {
        return textResult(await client.registerCreditWebhook({ url, symbols }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}
