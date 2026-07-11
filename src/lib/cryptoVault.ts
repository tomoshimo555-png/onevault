import type { CryptoEnvelope, EncryptedPayload } from "../types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const DEFAULT_ITERATIONS = 600_000;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const value of array) binary += String.fromCharCode(value);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveWrappingKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBytes(key: CryptoKey, value: Uint8Array<ArrayBuffer>, aad: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad), tagLength: 128 },
    key,
    value,
  );
  return { version: 1, iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function decryptBytes(key: CryptoKey, payload: EncryptedPayload, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const clear = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(payload.iv),
      additionalData: encoder.encode(aad),
      tagLength: 128,
    },
    key,
    fromBase64(payload.ciphertext),
  );
  return new Uint8Array(clear);
}

export async function encryptJson(key: CryptoKey, value: unknown, aad: string): Promise<EncryptedPayload> {
  return encryptBytes(key, encoder.encode(JSON.stringify(value)), aad);
}

export async function decryptJson<T>(key: CryptoKey, payload: EncryptedPayload, aad: string): Promise<T> {
  return JSON.parse(decoder.decode(await decryptBytes(key, payload, aad))) as T;
}

export async function createCryptoEnvelope(passphrase: string): Promise<{ envelope: CryptoEnvelope; key: CryptoKey }> {
  const dataKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawDataKey = await crypto.subtle.exportKey("raw", dataKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(passphrase, salt, DEFAULT_ITERATIONS);
  const wrappedKey = await encryptBytes(wrappingKey, new Uint8Array(rawDataKey), "onevault:data-key:v1");
  const verifier = await encryptBytes(dataKey, encoder.encode("ONEVAULT_UNLOCKED"), "onevault:verifier:v1");
  return {
    key: dataKey,
    envelope: {
      id: "crypto",
      version: 1,
      salt: toBase64(salt),
      iterations: DEFAULT_ITERATIONS,
      wrappedKey,
      verifier,
    },
  };
}

export async function unlockCryptoEnvelope(passphrase: string, envelope: CryptoEnvelope): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(passphrase, fromBase64(envelope.salt), envelope.iterations);
  const rawDataKey = await decryptBytes(wrappingKey, envelope.wrappedKey, "onevault:data-key:v1");
  const dataKey = await crypto.subtle.importKey("raw", rawDataKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const marker = decoder.decode(await decryptBytes(dataKey, envelope.verifier, "onevault:verifier:v1"));
  if (marker !== "ONEVAULT_UNLOCKED") throw new Error("PINが正しくありません");
  return dataKey;
}

export function isStrongPassphrase(value: string): boolean {
  const isNumeric = /^\d+$/.test(value);
  return isNumeric ? value.length >= 8 : value.length >= 8;
}
