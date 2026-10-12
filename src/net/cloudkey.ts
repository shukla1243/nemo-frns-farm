/**
 * The cloud save key (see cloudsave.ts). Kept free of nostr-tools so the main chunk can check for a
 * cached key without loading the relay client.
 */
const MESSAGE = "NEMO FRNS FARM cloud save v1\n\nSign to unlock your encrypted cross-device save.\nThis is free: it is not a transaction and costs no gas.";

type Provider = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> };

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map(x => parseInt(x, 16)));
const cacheKey = (account: string) => `nemo-frns-farm:cloud:${account.toLowerCase()}`;

export function cachedCloudKey(account: string): Uint8Array | null {
  try {
    const v = localStorage.getItem(cacheKey(account));
    return v && /^[0-9a-f]{64}$/.test(v) ? unhex(v) : null;
  } catch { return null; }
}

export async function deriveCloudKey(provider: Provider, account: string): Promise<Uint8Array> {
  const cached = cachedCloudKey(account);
  if (cached) return cached;
  const msgHex = "0x" + hex(new TextEncoder().encode(MESSAGE));
  const sig = await provider.request({ method: "personal_sign", params: [msgHex, account] });
  if (typeof sig !== "string" || !/^0x([0-9a-fA-F]{2})+$/.test(sig)) throw new Error("The wallet did not return a signature.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", unhex(sig.slice(2).toLowerCase())));
  try { localStorage.setItem(cacheKey(account), hex(digest)); } catch { /* storage unavailable */ }
  return digest;
}

