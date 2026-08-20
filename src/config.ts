import { privateKeyToAccount } from "viem/accounts";
import type { HoodGrowClientOptions } from "hoodgrow";

/**
 * Reads credentials from the environment the MCP server process was
 * started with — each caller/host configures their own, HoodGrow never
 * bundles a shared credential into this package. `HOODGROW_API_KEY` wins
 * if both are set, matching HoodGrowClient's own precedence.
 *
 * BOTH ARE OPTIONAL. With neither, the returned options carry no
 * credentials: `get_catalog` is free and unmetered, and the paid tools
 * return the server's 402 on their FIRST call, as a readable tool error
 * naming the alternatives. There used to be an anonymous per-IP daily
 * allowance in front of that 402; it is gone, because keying it on the
 * caller's IP gave a fresh allowance to every address a pooled egress
 * used, and nobody ever reached the paywall.
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
  // No credentials is a valid setup, not an error. get_catalog is free and
  // unmetered, so a host can add this server and get real answers — every
  // listed token, live price, 24h change, adjusted supply — before deciding
  // whether to obtain anything. The per-symbol tools answer 402 instead,
  // which is a readable tool error rather than a failure to start.
  //
  // This used to throw, which meant the server refused to start at all: a
  // user had to get a key or fund a wallet before they could see one
  // response, on an API whose catalog costs nothing.
  return { ...(baseUrl ? { baseUrl } : {}) };
}
