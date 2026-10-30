/**
 * Browser-side E2EE primitives.
 * Private ECDH keys are persisted as non-extractable CryptoKeys in IndexedDB.
 * Plaintext and file bytes are encrypted before any Supabase request.
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "setupsocial-e2ee";
const STORE = "device-keys";
const DEVICE_KEY = "current";
const enc = new TextEncoder();
const dec = new TextDecoder();

export type CipherPayload = {
  version: 1;
  algorithm: "AES-256-GCM";
  nonce: string;
  ciphertext: string;
};

export type KeyEnvelope = {
  version: 1;
  algorithm: "ECDH-P256/HKDF-SHA-256/AES-256-GCM";
  ephemeralPublicKey: JsonWebKey;
  salt: string;
  nonce: string;
  wrappedKey: string;
};

export type LocalDeviceKeys = {
  publicKey: JsonWebKey;
  privateKey: CryptoKey;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredKeys(): Promise<LocalDeviceKeys | null> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(DEVICE_KEY);
    request.onsuccess = () => { db.close(); resolve(request.result ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function storeKeys(keys: LocalDeviceKeys): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(keys, DEVICE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getOrCreateDeviceKeys(): Promise<LocalDeviceKeys> {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error("Este navegador não oferece armazenamento seguro de chaves (Web Crypto/IndexedDB).");
  }
  const existing = await readStoredKeys();
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const keys = { publicKey, privateKey: pair.privateKey };
  await storeKeys(keys);
  return keys;
}

export async function registerCurrentDevice(label = "Navegador"): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login para registrar este dispositivo.");
  const keys = await getOrCreateDeviceKeys();
  const { data: existing, error: lookupError } = await (supabase as any)
    .from("user_crypto_devices").select("id")
    .eq("user_id", auth.user.id).eq("public_key", JSON.stringify(keys.publicKey))
    .is("revoked_at", null).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) return existing.id;
  const { data, error } = await (supabase as any).from("user_crypto_devices")
    .insert({ user_id: auth.user.id, device_label: label, public_key: JSON.stringify(keys.publicKey) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function deriveWrappingKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const material = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("SetupSocial E2EE key envelope v1") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createKeyEnvelope(
  rawConversationKey: Uint8Array,
  recipientPublicJwk: JsonWebKey,
): Promise<KeyEnvelope> {
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  ) as CryptoKeyPair;
  const recipientPublic = await crypto.subtle.importKey(
    "jwk", recipientPublicJwk, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(ephemeral.privateKey, recipientPublic, salt);
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, wrappingKey, rawConversationKey);
  return {
    version: 1,
    algorithm: "ECDH-P256/HKDF-SHA-256/AES-256-GCM",
    ephemeralPublicKey: await crypto.subtle.exportKey("jwk", ephemeral.publicKey),
    salt: bytesToBase64(salt),
    nonce: bytesToBase64(nonce),
    wrappedKey: bytesToBase64(new Uint8Array(wrapped)),
  };
}

export async function openKeyEnvelope(envelope: KeyEnvelope): Promise<Uint8Array> {
  const local = await getOrCreateDeviceKeys();
  const ephemeralPublic = await crypto.subtle.importKey(
    "jwk", envelope.ephemeralPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const wrappingKey = await deriveWrappingKey(
    local.privateKey, ephemeralPublic, base64ToBytes(envelope.salt),
  );
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.nonce) },
    wrappingKey,
    base64ToBytes(envelope.wrappedKey),
  );
  return new Uint8Array(raw);
}

export async function encryptText(plaintext: string, rawKey: Uint8Array): Promise<CipherPayload> {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, enc.encode(plaintext));
  return { version: 1, algorithm: "AES-256-GCM", nonce: bytesToBase64(nonce), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function decryptText(payload: CipherPayload, rawKey: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.nonce) }, key, base64ToBytes(payload.ciphertext),
  );
  return dec.decode(plaintext);
}

export async function encryptFile(file: File, rawKey: Uint8Array): Promise<{ blob: Blob; nonce: string; mimeType: string; fileName: string }> {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, await file.arrayBuffer());
  return { blob: new Blob([ciphertext], { type: "application/octet-stream" }), nonce: bytesToBase64(nonce), mimeType: file.type || "application/octet-stream", fileName: file.name };
}

export async function decryptFile(blob: Blob, nonceBase64: string, mimeType: string, rawKey: Uint8Array): Promise<Blob> {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(nonceBase64) }, key, await blob.arrayBuffer(),
  );
  return new Blob([plaintext], { type: mimeType });
}

export function generateConversationKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
