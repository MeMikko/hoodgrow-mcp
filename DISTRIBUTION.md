# Distribution — getting hoodgrow-mcp discovered

A checklist and ready-to-paste copy for listing HoodGrow's MCP server in the
public registries and directories where people look for MCP servers. Two
things to distribute:

1. **Hosted server** — `https://www.hoodgrow.com/api/mcp` (Streamable HTTP,
   read-only, anonymous; no install, no key). This is the one to lead with —
   it's the lowest-friction way to try HoodGrow.
2. **npm package** — [`hoodgrow-mcp`](https://www.npmjs.com/package/hoodgrow-mcp)
   (stdio, run locally with your own API key / x402 wallet).

## One-liner (use verbatim everywhere)

> Robinhood Chain stock-token data as MCP tools — live price, corporate-action
> adjusted supply (ERC-8056, correct through splits), DeFi depth, splits &
> dividends, holders, slippage, OHLC, market movers, and a whale-trade feed.

## Longer blurb (registry descriptions)

> HoodGrow exposes verified Robinhood Chain stock-token data as Model Context
> Protocol tools: live Chainlink price, corporate-action **adjusted** supply
> that stays correct through stock splits (ERC-8056 `uiMultiplier`), Morpho/
> Uniswap DeFi depth, pending & historical corporate actions, holder
> analytics, trade slippage estimates, OHLC candles for backtesting, market
> movers, and a large-trade ("whale") feed. Use the hosted server with no key,
> or run the npm package with a free API key or x402 pay-per-call.

## Tags / keywords

`mcp` `robinhood-chain` `stock-tokens` `defi` `x402` `erc-8056`
`corporate-actions` `stock-splits` `chainlink` `crypto` `finance`

## Registries & directories — submission checklist

| Registry | How to submit | Status |
|---|---|---|
| **modelcontextprotocol/servers** (official "community servers" list) | PR adding a row to the README | ☐ |
| **mcp.so** | Submit form at mcp.so | ☐ |
| **Glama** (glama.ai/mcp/servers) | Auto-indexes from GitHub; add MCP topic + a `glama.json`; claim the listing | ☐ |
| **Smithery** (smithery.ai) | Connect the GitHub repo; add `smithery.yaml` if hosting there | ☐ |
| **PulseMCP** (pulsemcp.com) | Submit form | ☐ |
| **Awesome MCP Servers** (punkpeye/awesome-mcp-servers) | PR adding a bullet | ☐ |
| **MCP.run / other aggregators** | As they appear | ☐ |
| **npm** | Already published — keep `keywords` in package.json current | ☑ |

### GitHub repo hygiene (helps auto-indexers)

- ☐ Repo **description** set to the one-liner above.
- ☐ Repo **topics**: the tags above.
- ☐ README leads with the hosted no-key quick-start (done).
- ☐ A clear **license** (MIT).

### Ready-to-paste row for `modelcontextprotocol/servers`

```markdown
- **[HoodGrow](https://github.com/MeMikko/hoodgrow-mcp)** — Robinhood Chain
  stock-token data: live price, split-adjusted supply (ERC-8056), DeFi depth,
  corporate actions, holders, slippage, OHLC, movers, and whale trades.
```

### Ready-to-paste bullet for "awesome" lists

```markdown
- [hoodgrow-mcp](https://github.com/MeMikko/hoodgrow-mcp) 🌐 📇 — Verified
  Robinhood Chain stock-token data (price, split-adjusted supply, DeFi,
  corporate actions, movers, whale trades). Hosted (no key) or npm.
```

## Notes

- Lead every listing with the **hosted URL** — "no install, no key" converts
  far better than "npm install + get an API key".
- Keep the tool count / feature list in listings in sync with `src/server.ts`
  (currently 14 tools) when it changes.
