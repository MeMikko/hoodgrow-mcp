# hoodgrow-mcp

MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server for the
[HoodGrow](https://www.hoodgrow.com) Robinhood Chain stock token API — live
price, corporate-action adjusted supply (ERC-8056, correct through stock
splits), Morpho/Uniswap DeFi depth, corporate actions (splits, dividends),
holder analytics, trade price-impact/slippage estimates, OHLC price
candles for backtesting, market movers, a large-trade ("whale") feed,
and a Base mainnet B20 native-equity-token registry, exposed as tools for
any MCP client (Claude Desktop, Claude Code, etc). Built on the
[`hoodgrow`](https://github.com/MeMikko/hoodgrow-ts) SDK — pays per call via
**x402** (USDC on Base) or uses a bearer API key, your choice.

## Setup

You need credentials — this package never bundles a shared HoodGrow
credential, you supply your own so you control what gets spent and who's
billed. Pick one:

- **x402, pay per call, no signup** — a wallet private key (`HOODGROW_PRIVATE_KEY`),
  funded with USDC on Base. $0.10/call for the full catalog, $0.05/call for
  one token.
- **API key, free, issued access** — `HOODGROW_API_KEY` from
  [hoodgrow.com/api-access](https://www.hoodgrow.com/api-access).

### Claude Desktop / Claude Code

Add to your MCP config (Claude Desktop: `claude_desktop_config.json`; Claude
Code: `claude mcp add`):

```json
{
  "mcpServers": {
    "hoodgrow": {
      "command": "npx",
      "args": ["-y", "hoodgrow-mcp"],
      "env": {
        "HOODGROW_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

Or with an API key instead:

```json
{
  "mcpServers": {
    "hoodgrow": {
      "command": "npx",
      "args": ["-y", "hoodgrow-mcp"],
      "env": {
        "HOODGROW_API_KEY": "..."
      }
    }
  }
}
```

Never hardcode a real private key in a committed config file — only fund
that wallet with what you're willing to spend on this API.

Optionally, once you've bought a credit balance with the `buy_credits` tool,
add `"HOODGROW_USE_CREDITS": "true"` alongside `HOODGROW_PRIVATE_KEY` to
have every data tool spend that balance (a cheap wallet signature) instead
of paying x402 per call. See "Prepaid credits" below.

## Tools

| Tool | Price (x402) | Description |
| --- | --- | --- |
| `get_catalog` | $0.10 | Every listed token: price, source, 24h change, corporate-action adjusted supply, DeFi depth, plus catalog-wide pending/recent corporate actions |
| `get_token` | $0.05 | One token by symbol (e.g. `NVDA`), same fields, scoped |
| `get_corporate_actions` | uses `get_token`/`get_catalog` above | Pending + recent corporate actions; pass a symbol to scope, omit for every tracked token |
| `get_defi` | $0.05 | Every Morpho market a token participates in (loan OR collateral role) plus its Uniswap V3 pools — not just the single best-APY figure in `get_catalog`/`get_token` |
| `get_holders` | $0.05 | Holder-count trend, 24h net supply change (real mint/burn), and top-holder concentration (optional `limit`, 1-50, defaults to 10) |
| `get_slippage` | $0.05 | How much a USD-sized trade (`side: "buy" \| "sell"`) would move the price, per Uniswap V3 pool — includes `bestPoolAddress`/`bestEffectivePrice` picking the best one for you |
| `get_ohlc` | $0.05 | OHLC price candles for backtesting (`interval: "1h" \| "4h" \| "1d"`, optional `from`/`to`/`limit`, defaults to the last 30 days). Each candle carries `volumeUsd`/`swapCount` — USD swap volume across the token's Uniswap V3 pools — `null` for buckets older than the volume indexer's backfill window |
| `get_base_tokens` | $0.05 | Base mainnet (chain 8453) B20 native-equity-token registry — a much smaller sibling of `get_catalog`. **Pre-launch**: check each token's `status` before treating it as tradable — `"pre_launch"` means no price, no DEX liquidity, no holders exist for it yet |
| `get_markets` | $0.05 | Market movers across the whole catalog: top gainers/losers (24h change), highest 24h swap volume, and deepest Uniswap V3 liquidity (TVL). Optional `limit` (1-50, default 10); gainers/losers can be empty on a flat market |
| `get_trades` | $0.05 | Recent large ("whale") trades in the stock-token Uniswap V3 pools, newest first — each with `side` (`"buy" \| "sell"`), USD size, and `txHash`. Omit `symbol` for the global feed; optional `limit` (1-100, default 20) |
| `list_credit_bundles` | free | Current prepaid credit bundle catalog (`{id: {priceUsd, creditUsd}}`) — no credentials needed |
| `buy_credits` | one x402 payment | Pays for one bundle (`bundleId` arg); requires `HOODGROW_PRIVATE_KEY`. Balance lands once settlement confirms — check with `get_credit_balance` |
| `get_credit_balance` | free | This wallet's current credit balance; requires `HOODGROW_PRIVATE_KEY` |

Each call returns the API's JSON response as the tool's text content. A
failed request (unknown symbol, server error) comes back as an MCP tool
error (`isError: true`) rather than crashing the server.

## Prepaid credits

Buy a dollar-denominated credit balance once via x402 (`buy_credits`), then
set `HOODGROW_USE_CREDITS=true` (alongside `HOODGROW_PRIVATE_KEY`) and
restart the server: every data tool above then spends the balance with a
cheap, gas-free wallet signature instead of a fresh on-chain x402 payment
per call. `list_credit_bundles`/`get_credit_balance` never spend anything;
only the metered data tools (`get_catalog`, `get_token`, etc.) and
`buy_credits` itself move money.

## Payment safety

x402 payments are real money and are **not** idempotent — a retried timed-out
call can pay twice. HoodGrow's paywall only ever asks for USDC
(`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) on Base mainnet
(`eip155:8453`), paid to `0x8520B3693a2Cf3c2bEa3a505Af3A9c1b093954c7`, capped
at $0.10/call — the underlying `hoodgrow`/`@x402` dependencies handle
protocol-level verification, but you're responsible for how much you fund
the signing wallet with.

## Rate limits

30 requests/minute per IP by default for pay-per-call use. Need more
sustained throughput? A persistent API key with its own higher limit is
available — see
[hoodgrow.com/api-access](https://www.hoodgrow.com/api-access).

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (mocked fetch + real in-memory MCP client/server, no network)
```

## License

MIT
