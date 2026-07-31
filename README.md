# hoodgrow-mcp

MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server for the
[HoodGrow](https://www.hoodgrow.com) Robinhood Chain stock token API — live
price, corporate-action adjusted supply (ERC-8056, correct through stock
splits), Morpho/Uniswap DeFi depth, and corporate actions (splits, dividends),
exposed as tools for any MCP client (Claude Desktop, Claude Code, etc). Built
on the [`hoodgrow`](https://github.com/MeMikko/hoodgrow-ts) SDK — pays per
call via **x402** (USDC on Base) or uses a bearer API key, your choice.

## Setup

You need credentials — this package never bundles a shared HoodGrow
credential, you supply your own so you control what gets spent and who's
billed. Pick one:

- **x402, pay per call, no signup** — a wallet private key (`HOODGROW_PRIVATE_KEY`),
  funded with USDC on Base. $0.50/call for the full catalog, $0.05/call for
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

## Tools

| Tool | Price (x402) | Description |
| --- | --- | --- |
| `get_catalog` | $0.50 | Every listed token: price, source, 24h change, corporate-action adjusted supply, DeFi depth, plus catalog-wide pending/recent corporate actions |
| `get_token` | $0.05 | One token by symbol (e.g. `NVDA`), same fields, scoped |
| `get_corporate_actions` | uses `get_token`/`get_catalog` above | Pending + recent corporate actions; pass a symbol to scope, omit for every tracked token |

Each call returns the API's JSON response as the tool's text content. A
failed request (unknown symbol, server error) comes back as an MCP tool
error (`isError: true`) rather than crashing the server.

## Payment safety

x402 payments are real money and are **not** idempotent — a retried timed-out
call can pay twice. HoodGrow's paywall only ever asks for USDC
(`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) on Base mainnet
(`eip155:8453`), paid to `0x8520B3693a2Cf3c2bEa3a505Af3A9c1b093954c7`, capped
at $0.50/call — the underlying `hoodgrow`/`@x402` dependencies handle
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
