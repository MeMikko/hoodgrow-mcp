import { test } from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { privateKeyToAccount } from "viem/accounts";

import { createServer } from "../src/server.js";
import { clientOptionsFromEnv } from "../src/config.js";

/** Well-known public test private key (Hardhat/Anvil default account #0) —
 * never funded, safe to hardcode in a test file. */
const TEST_ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);

/** Wires a real MCP Client to our server over an in-memory transport pair —
 * exercises the actual list/call-tool protocol path, not just our own code. */
async function connectedClient(clientOptions: Parameters<typeof createServer>[0]) {
  const server = createServer(clientOptions);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

test("clientOptionsFromEnv throws without credentials", () => {
  assert.throws(() => clientOptionsFromEnv({} as NodeJS.ProcessEnv), /needs credentials/);
});

test("clientOptionsFromEnv prefers HOODGROW_API_KEY over HOODGROW_PRIVATE_KEY", () => {
  const opts = clientOptionsFromEnv({
    HOODGROW_API_KEY: "key-123",
    HOODGROW_PRIVATE_KEY: "0x" + "1".repeat(64),
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(opts, { apiKey: "key-123" });
});

test("clientOptionsFromEnv builds a signer from HOODGROW_PRIVATE_KEY", () => {
  const opts = clientOptionsFromEnv({
    HOODGROW_PRIVATE_KEY: "0x" + "1".repeat(64),
  } as unknown as NodeJS.ProcessEnv);
  assert.ok(opts.signer);
  assert.ok(opts.signer.address.startsWith("0x"));
});

test("lists exactly the eleven documented tools", async () => {
  const { client } = await connectedClient({ apiKey: "test-key" });
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    [
      "buy_credits",
      "get_base_tokens",
      "get_catalog",
      "get_corporate_actions",
      "get_credit_balance",
      "get_defi",
      "get_holders",
      "get_ohlc",
      "get_slippage",
      "get_token",
      "list_credit_bundles",
    ]
  );
});

test("get_catalog calls the API and returns catalog JSON as tool text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        chainId: 4663,
        updatedAt: "2026-07-30T00:00:00.000Z",
        tokens: [],
        pendingCorporateActions: [],
        recentCorporateActions: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({ name: "get_catalog", arguments: {} });
    assert.equal(result.isError, undefined);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.equal(JSON.parse(text).chainId, 4663);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_token surfaces a HoodGrowError as an MCP tool error, not a thrown exception", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Unknown symbol" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({ name: "get_token", arguments: { symbol: "NOTREAL" } });
    assert.equal(result.isError, true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.match(text, /404/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_corporate_actions omits symbol to scope to all tokens", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return new Response(
      JSON.stringify({
        chainId: 4663,
        updatedAt: "2026-07-30T00:00:00.000Z",
        tokens: [],
        pendingCorporateActions: [],
        recentCorporateActions: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    await client.callTool({ name: "get_corporate_actions", arguments: {} });
    assert.equal(capturedUrl, "https://www.hoodgrow.com/api/agent/tokens");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_defi calls the defi endpoint for the given symbol", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return new Response(
      JSON.stringify({
        chainId: 4663,
        symbol: "NVDA",
        updatedAt: "2026-08-08T00:00:00.000Z",
        morphoMarkets: [],
        uniswapPools: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({ name: "get_defi", arguments: { symbol: "nvda" } });
    assert.equal(result.isError, undefined);
    assert.equal(capturedUrl, "https://www.hoodgrow.com/api/agent/defi/NVDA");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_holders passes limit through as a query param", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return new Response(
      JSON.stringify({
        chainId: 4663,
        symbol: "NVDA",
        updatedAt: "2026-08-08T00:00:00.000Z",
        holderCount: 1342,
        holderCountDelta: null,
        holderCountDeltaSinceTs: null,
        holderSnapshotTs: null,
        supplyChange24h: null,
        topHolders: { snapshotTs: null, totalHolders: 0, holders: [] },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    await client.callTool({ name: "get_holders", arguments: { symbol: "nvda", limit: 25 } });
    assert.equal(capturedUrl, "https://www.hoodgrow.com/api/agent/holders/NVDA?limit=25");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_slippage surfaces a HoodGrowError as an MCP tool error, not a thrown exception", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Unknown symbol" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({
      name: "get_slippage",
      arguments: { symbol: "NOTREAL", amountUsd: 10000, side: "buy" },
    });
    assert.equal(result.isError, true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.match(text, /404/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_ohlc passes interval/from/to/limit through as query params", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return new Response(
      JSON.stringify({
        chainId: 4663,
        symbol: "NVDA",
        interval: "1d",
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-08T00:00:00.000Z",
        candles: [],
        note: "OHLC only — no volume field.",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({
      name: "get_ohlc",
      arguments: {
        symbol: "nvda",
        interval: "1d",
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
        limit: 30,
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal(
      capturedUrl,
      "https://www.hoodgrow.com/api/agent/ohlc/NVDA?interval=1d&from=2026-07-01T00%3A00%3A00.000Z&to=2026-08-01T00%3A00%3A00.000Z&limit=30"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_ohlc surfaces a HoodGrowError as an MCP tool error, not a thrown exception", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Unknown symbol" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({
      name: "get_ohlc",
      arguments: { symbol: "NOTREAL", interval: "1h" },
    });
    assert.equal(result.isError, true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.match(text, /404/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_base_tokens calls the Base registry endpoint and returns the pre-launch note", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    return new Response(
      JSON.stringify({
        chainId: 8453,
        updatedAt: "2026-08-08T12:00:00.000Z",
        note: "PRE-LAUNCH: ...",
        tokens: [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            address: "0xb200000000000000000000C2e324d24d7eEcd1fb",
            decimals: 8,
            status: "pre_launch",
            totalSupplyRaw: "0",
            totalSupply: 0,
            checkedAt: "2026-08-08T12:00:00.000Z",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({ name: "get_base_tokens", arguments: {} });
    assert.equal(result.isError, undefined);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.equal(JSON.parse(text).chainId, 8453);
    assert.equal(capturedUrl, "https://www.hoodgrow.com/api/agent/base/tokens");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("list_credit_bundles works with an apiKey client (no signer needed)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ bundles: { "10": { priceUsd: 10, creditUsd: 11 } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const { client } = await connectedClient({ apiKey: "test-key" });
    const result = await client.callTool({ name: "list_credit_bundles", arguments: {} });
    assert.equal(result.isError, undefined);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.equal(JSON.parse(text)["10"].priceUsd, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("get_credit_balance surfaces the 'requires a signer' error for an apiKey-only client", async () => {
  const { client } = await connectedClient({ apiKey: "test-key" });
  const result = await client.callTool({ name: "get_credit_balance", arguments: {} });
  assert.equal(result.isError, true);
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  assert.match(text, /requires a `signer`/);
});

test("buy_credits surfaces the 'requires a signer' error for an apiKey-only client", async () => {
  const { client } = await connectedClient({ apiKey: "test-key" });
  const result = await client.callTool({ name: "buy_credits", arguments: { bundleId: "10" } });
  assert.equal(result.isError, true);
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  assert.match(text, /requires a `signer`/);
});

test("get_credit_balance calls the balance endpoint with a signer and returns the balance", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    capturedHeaders = (init?.headers as Record<string, string> | undefined) ?? {};
    return new Response(
      JSON.stringify({ walletAddress: TEST_ACCOUNT.address.toLowerCase(), balanceUsd: 5.5 }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    const { client } = await connectedClient({ signer: TEST_ACCOUNT });
    const result = await client.callTool({ name: "get_credit_balance", arguments: {} });
    assert.equal(result.isError, undefined);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    assert.equal(JSON.parse(text).balanceUsd, 5.5);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(capturedUrl, "https://www.hoodgrow.com/api/agent/credits/balance");
  assert.equal(capturedHeaders["X-HoodGrow-Credit-Wallet"], TEST_ACCOUNT.address);
});
