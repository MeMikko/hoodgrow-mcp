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

## Official MCP Registry (registry.modelcontextprotocol.io)

This is the canonical registry many clients/aggregators read from, and it's
the highest-leverage listing. It's driven by [`server.json`](./server.json) in
this repo (kept at the current version, with both the npm package and the
hosted `https://www.hoodgrow.com/api/mcp` remote) plus the `mcpName` field in
`package.json` that proves package ownership.

Publish (one-time auth via GitHub, then per release):

```bash
# install the official publisher CLI (see modelcontextprotocol/registry)
mcp-publisher login github     # authenticates the io.github.MeMikko namespace
mcp-publisher validate         # checks server.json against the schema
mcp-publisher publish          # pushes this server.json to the registry
```

Keep `server.json`'s `version` and `packages[].version` in lockstep with
`package.json` on every release, and re-run `mcp-publisher publish`.

## Registries & directories — submission checklist

| Registry | How to submit | Status |
|---|---|---|
| **Official MCP Registry** (registry.modelcontextprotocol.io) | Automatic — publish.yml runs `mcp-publisher publish` on every release | ☑ live since 2026-08-07 |
| **modelcontextprotocol/servers** (official "community servers" list) | PR adding a row to the README | ☐ |
| **mcp.so** | Submit form at mcp.so | ⏭️ skipped — listing costs $39, and it is the least curated of the directories (~20k servers), so it is the worst value of the set. Revisit only if the free four underdeliver |
| **Glama** (glama.ai/mcp/servers) | Auto-indexed from GitHub; claimed via the Admin tab | ☑ claimed 2026-08-17 — author verified, A on license / coherence / tool definitions / maintenance |
| **Smithery** (smithery.ai) | Connect the GitHub repo; add `smithery.yaml` if hosting there | ☐ |
| **PulseMCP** (pulsemcp.com) | Submit form | ☐ |
| **Awesome MCP Servers** (punkpeye/awesome-mcp-servers) | PR adding a bullet | ☐ |
| **MCP.run / other aggregators** | As they appear | ☐ |
| **npm** | Already published — keep `keywords` in package.json current | ☑ |

### GitHub repo hygiene (helps auto-indexers)

All four are done — verified against the GitHub API on 2026-08-17, not from
memory. Left here as the checklist a future move or rename has to re-satisfy.

- ☑ Repo **description** set to the one-liner above.
- ☑ Repo **topics**: all ten of the tags above.
- ☑ README leads with the hosted no-key quick-start.
- ☑ A clear **license** (MIT).

### Ready-to-paste row for `modelcontextprotocol/servers`

```markdown
- **[HoodGrow](https://github.com/MeMikko/hoodgrow-mcp)** — Robinhood Chain
  stock-token data: live price, split-adjusted supply (ERC-8056), DeFi depth,
  corporate actions, holders, slippage, OHLC, movers, and whale trades.
```

### Ready-to-paste bullet for punkpeye/awesome-mcp-servers

Category: **💰 - Finance & Fintech**. Check whether the neighbours are in
alphabetical order before appending — that list is not uniformly sorted.

The emoji are not decoration, they are that README's legend, and it was
checked against the legend rather than guessed: `📇` is a TypeScript
codebase and `☁️` is a cloud service. `🌐`, which an earlier version of this
file used, is not in the legend at all — the most common reason one of
these PRs sits unmerged. Note the plain hyphen before the description;
established entries do not use an em dash.

```markdown
- [MeMikko/hoodgrow-mcp](https://github.com/MeMikko/hoodgrow-mcp) [![hoodgrow-mcp MCP server](https://glama.ai/mcp/servers/MeMikko/hoodgrow-mcp/badges/score.svg)](https://glama.ai/mcp/servers/MeMikko/hoodgrow-mcp) 📇 ☁️ - Robinhood Chain stock-token data: live price, split-adjusted supply (ERC-8056), DeFi depth, corporate actions, holders, slippage, OHLC and whale trades. Hosted (no key) or npm; pay-per-call via x402.
```

### Glama badges

Two variants, and they are not interchangeable. `score.svg` is the small
inline badge that belongs in a list row or beside other badges;
`card.svg` is a full-width card for a page that has room for it.

```markdown
<!-- inline (README badge row, awesome-list entries) -->
[![hoodgrow-mcp MCP server](https://glama.ai/mcp/servers/MeMikko/hoodgrow-mcp/badges/score.svg)](https://glama.ai/mcp/servers/MeMikko/hoodgrow-mcp)

<!-- full card (a page with space for it) -->
[![hoodgrow-mcp MCP server](https://glama.ai/mcp/servers/MeMikko/hoodgrow-mcp/badges/card.svg)](https://glama.ai/mcp/servers/MeMikko/hoodgrow-mcp)
```

## Notes

- Lead every listing with the **hosted URL** — "no install, no key" converts
  far better than "npm install + get an API key".
- Keep the tool count / feature list in listings in sync with `src/server.ts`
  (currently 14 tools) when it changes.
