import { privateKeyToAccount } from "viem/accounts";
import type { HoodGrowClientOptions } from "hoodgrow";

/**
 * Reads credentials from the environment the MCP server process was
 * started with — each caller/host configures their own, HoodGrow never
 * bundles a shared credential into this package. `HOODGROW_API_KEY` wins
 * if both are set, matching HoodGrowClient's own precedence.
 */
export function clientOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): HoodGrowClientOptions {
  const apiKey = env.HOODGROW_API_KEY?.trim();
  const privateKey = env.HOODGROW_PRIVATE_KEY?.trim();
  const baseUrl = env.HOODGROW_BASE_URL?.trim();

  if (apiKey) {
    return { apiKey, ...(baseUrl ? { baseUrl } : {}) };
  }
  if (privateKey) {
    const signer = privateKeyToAccount(privateKey as `0x${string}`);
    return { signer, ...(baseUrl ? { baseUrl } : {}) };
  }
  throw new Error(
    "hoodgrow-mcp needs credentials: set HOODGROW_API_KEY (free, issued at " +
      "https://www.hoodgrow.com/api-access) or HOODGROW_PRIVATE_KEY (a wallet " +
      "private key that pays per call via x402 — USDC on Base, only fund it " +
      "with what you're willing to spend on this API)."
  );
}
