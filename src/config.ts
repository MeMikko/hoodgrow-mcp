import { privateKeyToAccount } from "viem/accounts";
import type { HoodGrowClientOptions } from "hoodgrow";

/**
 * Reads credentials from the environment the MCP server process was
 * started with — each caller/host configures their own, HoodGrow never
 * bundles a shared credential into this package. `HOODGROW_API_KEY` wins
 * if both are set, matching HoodGrowClient's own precedence.
 *
 * `HOODGROW_USE_CREDITS=true` (only meaningful alongside
 * `HOODGROW_PRIVATE_KEY`, ignored with `HOODGROW_API_KEY`) opts every data
 * tool into spending that wallet's prepaid credit balance instead of a
 * fresh x402 payment per call — see HoodGrowClientOptions.useCredits.
 * Defaults to false: an existing private-key-only setup keeps paying x402
 * per call exactly as before. Buy credits first with the buy_credits tool
 * (still works without this flag — buying/checking a balance never
 * requires useCredits itself), then set this once you actually have a
 * balance to spend.
 */
export function clientOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): HoodGrowClientOptions {
  const apiKey = env.HOODGROW_API_KEY?.trim();
  const privateKey = env.HOODGROW_PRIVATE_KEY?.trim();
  const baseUrl = env.HOODGROW_BASE_URL?.trim();
  const useCredits = env.HOODGROW_USE_CREDITS?.trim().toLowerCase() === "true";

  if (apiKey) {
    return { apiKey, ...(baseUrl ? { baseUrl } : {}) };
  }
  if (privateKey) {
    const signer = privateKeyToAccount(privateKey as `0x${string}`);
    return { signer, useCredits, ...(baseUrl ? { baseUrl } : {}) };
  }
  throw new Error(
    "hoodgrow-mcp needs credentials: set HOODGROW_API_KEY (free, self-serve at " +
      "https://www.hoodgrow.com/profile) or HOODGROW_PRIVATE_KEY (a wallet " +
      "private key that pays per call via x402 — USDC on Base, only fund it " +
      "with what you're willing to spend on this API)."
  );
}
