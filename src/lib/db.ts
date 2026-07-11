import Dexie, { type EntityTable } from "dexie";
import type { CryptoEnvelope, StoredSecret } from "../types";
import { decryptJson, encryptJson } from "./cryptoVault";

class OneVaultDatabase extends Dexie {
  crypto!: EntityTable<CryptoEnvelope, "id">;
  secrets!: EntityTable<StoredSecret, "id">;

  constructor() {
    super("onevault-v2");
    this.version(1).stores({
      crypto: "id",
      secrets: "id, updatedAt",
    });
  }
}

export const db = new OneVaultDatabase();

export async function putEncrypted<T>(key: CryptoKey, id: string, value: T): Promise<void> {
  const payload = await encryptJson(key, value, `onevault:secret:${id}:v1`);
  await db.secrets.put({ id, payload, updatedAt: Date.now() });
}

export async function getEncrypted<T>(key: CryptoKey, id: string): Promise<T | undefined> {
  const row = await db.secrets.get(id);
  if (!row) return undefined;
  return decryptJson<T>(key, row.payload, `onevault:secret:${id}:v1`);
}

export async function clearLocalVault(): Promise<void> {
  await db.transaction("rw", db.crypto, db.secrets, async () => {
    await db.crypto.clear();
    await db.secrets.clear();
  });
}
