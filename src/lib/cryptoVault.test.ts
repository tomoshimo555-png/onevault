import { describe, expect, it } from "vitest";
import { createCryptoEnvelope, decryptJson, encryptJson, unlockCryptoEnvelope } from "./cryptoVault";

describe("encrypted local cache", () => {
  it("round trips JSON with a passphrase-derived wrapped key", async () => {
    const { envelope, key } = await createCryptoEnvelope("12345678");
    const payload = await encryptJson(key, { title: "個人情報", path: "秘密/ノート.md" }, "test-record");
    expect(payload.ciphertext).not.toContain("個人情報");
    const unlocked = await unlockCryptoEnvelope("12345678", envelope);
    await expect(decryptJson(unlocked, payload, "test-record")).resolves.toEqual({ title: "個人情報", path: "秘密/ノート.md" });
  }, 20_000);

  it("rejects a wrong PIN", async () => {
    const { envelope } = await createCryptoEnvelope("12345678");
    await expect(unlockCryptoEnvelope("00000000", envelope)).rejects.toBeTruthy();
  }, 20_000);
});
